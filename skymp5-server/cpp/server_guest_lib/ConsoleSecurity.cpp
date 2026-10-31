#include "ConsoleSecurity.h"
#include "MpActor.h"
#include "WorldState.h"
#include <algorithm>
#include <cmath>
#include <ctime>
#include <limits>
#include <spdlog/spdlog.h>
#include <stdexcept>

namespace ConsoleSecurity {
nlohmann::json Policy::ToJson() const
{
  return { { "mode", mode },
           { "blockVanillaCheats", blockVanillaCheats },
           { "blockUnauthorizedServerCommands", true },
           { "monitorMovement", monitorMovement },
           { "movementEnforcement", movementEnforcement },
           { "logViolations", logViolations },
           { "logAllowedAdminCommands", logAllowedAdminCommands } };
}

Configuration Parse(const nlohmann::json& settings)
{
  Configuration result;
  const auto legacy = settings.find("enableConsoleCommandsForAll");
  if (legacy != settings.end() && (!legacy->is_boolean() || *legacy != false))
    result.diagnostics.push_back("LEGACY_CONSOLE_BYPASS_IGNORED");
  const auto found = settings.find("consoleSecurity");
  if (found == settings.end())
    return result;
  if (!found->is_object()) {
    result.diagnostics.push_back("INVALID_CONSOLE_SECURITY");
    return result;
  }
  auto& policy = result.policy;
  const auto& value = *found;
  const auto defaults = policy.ToJson();
  for (const auto& entry : value.items()) {
    if (!defaults.contains(entry.key()))
      result.diagnostics.push_back("UNKNOWN_CONSOLE_SECURITY_FIELD");
  }
  const auto boolean = [&](const char* key, bool& target) {
    if (!value.contains(key))
      return;
    if (value[key].is_boolean())
      target = value[key].get<bool>();
    else
      result.diagnostics.push_back(std::string("INVALID_") + key);
  };
  if (value.contains("mode")) {
    if (value["mode"] == "restricted" || value["mode"] == "development")
      policy.mode = value["mode"].get<std::string>();
    else
      result.diagnostics.push_back("INVALID_CONSOLE_MODE");
  }
  boolean("blockVanillaCheats", policy.blockVanillaCheats);
  boolean("monitorMovement", policy.monitorMovement);
  boolean("logViolations", policy.logViolations);
  boolean("logAllowedAdminCommands", policy.logAllowedAdminCommands);
  if (value.contains("blockUnauthorizedServerCommands") &&
      value["blockUnauthorizedServerCommands"] != true)
    result.diagnostics.push_back("SERVER_AUTHORIZATION_REQUIRED");
  if (policy.mode == "restricted" && !policy.blockVanillaCheats) {
    policy.blockVanillaCheats = true;
    result.diagnostics.push_back("RESTRICTED_REQUIRES_VANILLA_PROTECTION");
  }
  if (value.contains("movementEnforcement")) {
    const auto& mode = value["movementEnforcement"];
    // "enforce" was never stricter than "monitor"; saved settings keep loading.
    if (mode == "enforce")
      policy.movementEnforcement = "monitor";
    else if (mode == "off" || mode == "monitor")
      policy.movementEnforcement = mode.get<std::string>();
    else
      result.diagnostics.push_back("INVALID_MOVEMENT_ENFORCEMENT");
  }
  return result;
}

const std::array<const char*, 4>& NativeCommands()
{
  static const std::array<const char*, 4> commands = { "additem", "equipitem",
                                                       "placeatme",
                                                       "disable" };
  return commands;
}

Request ValidateRequest(const std::string& input,
                        const std::vector<ConsoleCommands::Argument>& args)
{
  if (input.empty() || input.size() > 64)
    throw std::runtime_error("invalid_command");
  std::string name = input;
  for (auto& ch : name) {
    if (ch >= 'A' && ch <= 'Z')
      ch = static_cast<char>(ch - 'A' + 'a');
    if (!(ch >= 'a' && ch <= 'z'))
      throw std::runtime_error("unknown_command");
  }
  const bool mp = name == "mp";
  size_t count = 0;
  if (name == "additem")
    count = 3;
  else if (name == "equipitem" || name == "placeatme" || mp)
    count = 2;
  else if (name == "disable")
    count = 1;
  else
    throw std::runtime_error("unknown_command");
  if (args.size() != count)
    throw std::runtime_error("invalid_argument_count");
  const auto formId = [&](size_t index) {
    if (!args[index].IsInteger() || args[index].GetInteger() <= 0 ||
        args[index].GetInteger() > std::numeric_limits<uint32_t>::max())
      throw std::runtime_error("invalid_form_id");
    return static_cast<uint32_t>(args[index].GetInteger());
  };
  const auto target = formId(0);
  if (mp) {
    if (!args[1].IsString() || args[1].GetString().size() != 7)
      throw std::runtime_error("unknown_subcommand");
    auto subcommand = args[1].GetString();
    std::transform(
      subcommand.begin(), subcommand.end(), subcommand.begin(),
      [](unsigned char c) { return c >= 'A' && c <= 'Z' ? c + 32 : c; });
    if (subcommand != "disable")
      throw std::runtime_error("unknown_subcommand");
    name = "disable";
  } else if (count >= 2) {
    (void)formId(1);
  }
  if (name == "additem" &&
      (!args[2].IsInteger() || args[2].GetInteger() < 1 ||
       args[2].GetInteger() > 1000000))
    throw std::runtime_error("invalid_item_count");
  return { name, target };
}

bool IsAuthorized(const MpActor& actor, const std::string& command,
                  uint32_t targetId)
{
  const auto* world = actor.GetParent();
  if (world && world->consoleSecurity.authorizer) {
    try {
      const auto result =
        world->consoleSecurity.authorizer(actor, command, targetId);
      if (result.has_value())
        return *result;
    } catch (...) {
      return false;
    }
  }
  // The legacy global bypass is intentionally never consulted in either mode.
  return actor.GetConsoleCommandsAllowedFlag();
}

void State::Audit(const std::string& event, uint32_t actorId,
                  const std::string& command, const std::string& reason,
                  const std::string& source, bool blocked)
{
  const bool allowed = event == "console_command_allowed";
  if ((allowed && !policy.logAllowedAdminCommands) ||
      (!allowed && !policy.logViolations))
    return;
  const auto now = std::chrono::steady_clock::now();
  const auto key =
    event + ":" + std::to_string(actorId) + ":" + command + ":" + reason;
  auto it = logWindows.find(key);
  if (it != logWindows.end() &&
      now - it->second.at < std::chrono::seconds(5)) {
    ++it->second.suppressed;
    return;
  }
  const size_t repeated = it == logWindows.end() ? 0 : it->second.suppressed;
  if (logWindows.size() >= 1024 && it == logWindows.end())
    logWindows.erase(logWindows.begin());
  logWindows[key] = { now, 0 };
  const auto wall = std::chrono::system_clock::now();
  const auto time = std::chrono::system_clock::to_time_t(wall);
  std::tm utc{};
#ifdef _WIN32
  gmtime_s(&utc, &time);
#else
  gmtime_r(&time, &utc);
#endif
  char timestamp[32]{};
  std::strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &utc);
  const nlohmann::json entry = {
    { "event", event },       { "actorId", actorId },
    { "command", command },   { "reason", reason },
    { "source", source },     { "blocked", blocked },
    { "repeated", repeated }, { "timestamp", timestamp }
  };
  spdlog::info("[security] {}", entry.dump());
}

std::optional<std::string> ObserveMovement(
  const MovementSample& previous, const std::array<float, 3>& position,
  std::chrono::steady_clock::time_point now)
{
  const double seconds =
    std::chrono::duration<double>(now - previous.at).count();
  // Ignore tiny intervals and latency/loading gaps. Client-reported speed or
  // jump/mount flags are never used to authorize movement or exempt a player.
  if (seconds < 0.1 || seconds > 3.0)
    return std::nullopt;
  double distanceSquared = 0;
  for (size_t i = 0; i < 3; ++i) {
    const double delta = static_cast<double>(position[i]) - previous.pos[i];
    distanceSquared += delta * delta;
  }
  if (std::sqrt(distanceSquared) > 1400.0 * seconds + 600.0)
    return "speed_observation";
  if (static_cast<double>(position[2]) - previous.pos[2] >
      1000.0 * seconds + 500.0)
    return "vertical_observation";
  return std::nullopt;
}
} // namespace ConsoleSecurity
