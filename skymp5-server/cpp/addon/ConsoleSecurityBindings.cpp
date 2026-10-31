#include "ConsoleSecurity.h"
#include "MpActor.h"
#include "NapiHelper.h"
#include "ScampServer.h"
#include <cmath>
#include <limits>

namespace {
uint32_t Integer(const Napi::Value& value, uint32_t maximum)
{
  if (!value.IsNumber())
    throw std::runtime_error("Expected bounded integer");
  const auto number = value.As<Napi::Number>().DoubleValue();
  if (!std::isfinite(number) || std::floor(number) != number || number < 0 ||
      number > maximum)
    throw std::runtime_error("Expected bounded integer");
  return static_cast<uint32_t>(number);
}
}

Napi::Value ScampServer::GetConsoleSecurityState(
  const Napi::CallbackInfo& info)
{
  try {
    const auto& security = partOne->worldState.consoleSecurity;
    nlohmann::json value = { { "apiVersion", 1 },
                             { "policy", security.policy.ToJson() },
                             { "diagnostics", security.diagnostics },
                             { "serverAuthorization", "enforced" },
                             { "heuristicEnforcement", false },
                             { "movementRules",
                               { "finite_coordinates", "same_world_or_cell",
                                 "maximum_position_step" } } };
    if (info.Length() && !info[0].IsUndefined()) {
      const auto userId =
        Integer(info[0], std::numeric_limits<Networking::UserId>::max() - 1);
      auto* actor = partOne->serverState.IsConnected(userId)
        ? partOne->serverState.ActorByUser(userId)
        : nullptr;
      value["authenticated"] = actor != nullptr;
      value["allowedServerCommands"] = nlohmann::json::array();
      if (actor)
        for (const auto* command : ConsoleSecurity::NativeCommands()) {
          if (ConsoleSecurity::IsAuthorized(*actor, command,
                                            actor->GetFormId()))
            value["allowedServerCommands"].push_back(command);
        }
    }
    return NapiHelper::ParseJson(info.Env(), value);
  } catch (const std::exception& error) {
    throw Napi::Error::New(info.Env(), error.what());
  }
}

Napi::Value ScampServer::SetConsoleCommandAuthorizer(
  const Napi::CallbackInfo& info)
{
  try {
    if (info[0].IsNull()) {
      partOne->worldState.consoleSecurity.authorizer = {};
      return info.Env().Undefined();
    }
    auto function = NapiHelper::ExtractFunction(info[0], "authorizer");
    auto reference =
      std::make_shared<Napi::FunctionReference>(Napi::Persistent(function));
    partOne->worldState.consoleSecurity.authorizer =
      [reference, env = info.Env(),
       this](const MpActor& actor, const std::string& command,
             uint32_t targetId) -> std::optional<bool> {
      const auto userId =
        partOne->serverState.UserByActor(const_cast<MpActor*>(&actor));
      if (userId == Networking::InvalidUserId ||
          !partOne->serverState.IsConnected(userId))
        return false;
      try {
        auto context = Napi::Object::New(env);
        context.Set("userId", userId);
        context.Set("actorId", actor.GetFormId());
        context.Set("profileId", actor.GetProfileId());
        context.Set("targetId", targetId);
        context.Set("permission", "console." + command);
        context.Set("source", "native_console");
        const auto result = reference->Value().Call({ context });
        if (result.IsNull() || result.IsUndefined())
          return std::nullopt;
        if (result.IsBoolean())
          return result.As<Napi::Boolean>().Value();
      } catch (const Napi::Error&) {
        if (env.IsExceptionPending())
          env.GetAndClearPendingException();
      }
      return false;
    };
    return info.Env().Undefined();
  } catch (const std::exception& error) {
    throw Napi::Error::New(info.Env(), error.what());
  }
}

Napi::Value ScampServer::GrantMovementAllowance(const Napi::CallbackInfo& info)
{
  try {
    const auto actorId =
      Integer(info[0], std::numeric_limits<uint32_t>::max());
    const auto milliseconds = Integer(info[1], 30000);
    (void)partOne->worldState.GetFormAt<MpActor>(actorId);
    auto& security = partOne->worldState.consoleSecurity;
    if (!milliseconds)
      security.movementAllowances.erase(actorId);
    else
      security.movementAllowances[actorId] = {
        std::chrono::steady_clock::now() +
        std::chrono::milliseconds(milliseconds)
      };
    security.movement.erase(actorId);
    return info.Env().Undefined();
  } catch (const std::exception& error) {
    throw Napi::Error::New(info.Env(), error.what());
  }
}
