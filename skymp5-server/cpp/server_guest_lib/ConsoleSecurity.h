#pragma once
#include "ConsoleCommands.h"
#include <array>
#include <chrono>
#include <functional>
#include <map>
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

class MpActor;

namespace ConsoleSecurity {
struct Policy
{
  std::string mode = "restricted";
  bool blockVanillaCheats = true;
  bool blockUnauthorizedServerCommands = true;
  bool monitorMovement = true;
  std::string movementEnforcement = "monitor";
  bool logViolations = true;
  bool logAllowedAdminCommands = true;
  nlohmann::json ToJson() const;
};
struct Configuration
{
  Policy policy;
  std::vector<std::string> diagnostics;
};
Configuration Parse(const nlohmann::json& settings);
struct Request
{
  std::string command;
  uint32_t targetId = 0;
};
Request ValidateRequest(const std::string& name,
                        const std::vector<ConsoleCommands::Argument>& args);
const std::array<const char*, 4>& NativeCommands();
using Authorizer = std::function<std::optional<bool>(
  const MpActor&, const std::string&, uint32_t)>;
bool IsAuthorized(const MpActor& actor, const std::string& command,
                  uint32_t targetId);

struct MovementSample
{
  std::chrono::steady_clock::time_point at;
  std::array<float, 3> pos;
};
struct Allowance
{
  std::chrono::steady_clock::time_point until;
};
struct State
{
  Policy policy;
  std::vector<std::string> diagnostics;
  Authorizer authorizer;
  std::unordered_map<uint32_t, MovementSample> movement;
  std::unordered_map<uint32_t, Allowance> movementAllowances;
  struct LogWindow
  {
    std::chrono::steady_clock::time_point at;
    size_t suppressed = 0;
  };
  std::map<std::string, LogWindow> logWindows;
  void Audit(const std::string& event, uint32_t actorId,
             const std::string& command, const std::string& reason,
             const std::string& source, bool blocked);
};
// A conservative observation, never an authorization or an automatic ban.
std::optional<std::string> ObserveMovement(
  const MovementSample& previous, const std::array<float, 3>& position,
  std::chrono::steady_clock::time_point now);
} // namespace ConsoleSecurity
