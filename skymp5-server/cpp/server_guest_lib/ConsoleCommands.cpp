#include "ConsoleCommands.h"
#include "ConsoleSecurity.h"
#include "MpActor.h"
#include "WorldState.h"
#include "papyrus-vm/Utils.h"
#include "script_classes/PapyrusActor.h"
#include "script_classes/PapyrusObjectReference.h"
#include "script_objects/EspmGameObject.h"

ConsoleCommands::Argument::Argument()
{
  data = 0;
}

ConsoleCommands::Argument::Argument(int64_t integer)
{
  data = integer;
}

ConsoleCommands::Argument::Argument(const std::string& str)
{
  data = str;
}

ConsoleCommands::Argument::Argument(
  const std::variant<int64_t, std::string>& data_)
{
  data = data_;
}

bool ConsoleCommands::Argument::IsInteger() const noexcept
{
  return data.index() == 0;
}

bool ConsoleCommands::Argument::IsString() const noexcept
{
  return data.index() == 1;
};

int64_t ConsoleCommands::Argument::GetInteger() const
{
  if (!IsInteger())
    throw std::runtime_error(
      "ConsoleCommands::Argument - Expected to be Integer");
  return std::get<int64_t>(data);
}

const std::string& ConsoleCommands::Argument::GetString() const
{
  if (!IsString())
    throw std::runtime_error(
      "ConsoleCommands::Argument - Expected to be String");
  return std::get<std::string>(data);
}

namespace {

void EnsureAdmin(const MpActor& me, const std::string& command,
                 uint32_t targetId)
{
  bool isAdmin = ConsoleSecurity::IsAuthorized(me, command, targetId);
  if (!isAdmin) {
    throw std::runtime_error("Not enough permissions to use this command");
  }
}

void ExecuteAddItem(MpActor& caller,
                    const std::vector<ConsoleCommands::Argument>& args)
{

  const auto targetId = static_cast<uint32_t>(args.at(0).GetInteger());
  const auto itemId = static_cast<uint32_t>(args.at(1).GetInteger());
  const auto count = static_cast<int32_t>(args.at(2).GetInteger());

  MpObjectReference& target = (targetId == 0x14)
    ? caller
    : caller.GetParent()->GetFormAt<MpObjectReference>(targetId);

  auto& br = caller.GetParent()->GetEspm().GetBrowser();
  const auto record = br.LookupById(itemId);
  if (!record.rec)
    throw std::runtime_error("invalid_base_form");

  PapyrusObjectReference papyrusObjectReference;
  auto aItem = VarValue(std::make_shared<EspmGameObject>(record));
  auto aCount = VarValue(count);
  auto aSilent = VarValue(false);
  (void)papyrusObjectReference.AddItem(target.ToVarValue(),
                                       { aItem, aCount, aSilent });
}

void ExecuteEquipItem(MpActor& caller,
                      const std::vector<ConsoleCommands::Argument>& args)
{

  const auto targetId = static_cast<uint32_t>(args.at(0).GetInteger());
  const auto itemId = static_cast<uint32_t>(args.at(1).GetInteger());

  MpObjectReference& target = (targetId == 0x14)
    ? caller
    : caller.GetParent()->GetFormAt<MpObjectReference>(targetId);

  auto& br = caller.GetParent()->GetEspm().GetBrowser();
  const auto record = br.LookupById(itemId);
  if (!record.rec)
    throw std::runtime_error("invalid_base_form");

  PapyrusActor papyrusActor;
  auto aItem = VarValue(std::make_shared<EspmGameObject>(record));

  auto aForce = VarValue(false);
  auto aSilent = VarValue(false);
  (void)papyrusActor.EquipItem(target.ToVarValue(),
                               { aItem, aForce, aSilent });
}

void ExecutePlaceAtMe(MpActor& caller,
                      const std::vector<ConsoleCommands::Argument>& args)
{

  const auto targetId = static_cast<uint32_t>(args.at(0).GetInteger());
  const auto baseFormId = static_cast<uint32_t>(args.at(1).GetInteger());

  MpObjectReference& target = (targetId == 0x14)
    ? caller
    : caller.GetParent()->GetFormAt<MpObjectReference>(targetId);

  auto& br = caller.GetParent()->GetEspm().GetBrowser();
  const auto record = br.LookupById(baseFormId);
  if (!record.rec)
    throw std::runtime_error("invalid_base_form");

  PapyrusObjectReference papyrusObjectReference;
  auto aBaseForm = VarValue(std::make_shared<EspmGameObject>(record));
  auto aCount = VarValue(1);
  auto aForcePersist = VarValue(false);
  auto aInitiallyDisabled = VarValue(false);
  (void)papyrusObjectReference.PlaceAtMe(
    target.ToVarValue(),
    { aBaseForm, aCount, aForcePersist, aInitiallyDisabled });
}

void ExecuteDisable(MpActor& caller,
                    const std::vector<ConsoleCommands::Argument>& args)
{

  const auto targetId = static_cast<uint32_t>(args.at(0).GetInteger());

  MpObjectReference& target = (targetId == 0x14)
    ? caller
    : caller.GetParent()->GetFormAt<MpObjectReference>(targetId);

  // TODO: allow disable for all
  if (target.GetFormId() >= 0xff000000 ||
      dynamic_cast<MpActor*>(&target) != nullptr) {
    target.Disable();
  }
}

}

void ConsoleCommands::Execute(
  MpActor& me, const std::string& consoleCommandName,
  const std::vector<ConsoleCommands::Argument>& args)
{
  std::string command = "unknown";
  auto* world = me.GetParent();
  if (!world)
    throw std::runtime_error("console_actor_detached");
  try {
    const auto request =
      ConsoleSecurity::ValidateRequest(consoleCommandName, args);
    command = request.command;
    EnsureAdmin(me, command, request.targetId);
    if (command == "additem") {
      ExecuteAddItem(me, args);
    } else if (command == "equipitem") {
      ExecuteEquipItem(me, args);
    } else if (command == "placeatme") {
      ExecutePlaceAtMe(me, args);
    } else if (command == "disable") {
      ExecuteDisable(me, args);
    }
    world->consoleSecurity.Audit("console_command_allowed", me.GetFormId(),
                                 command, "authorized", "native_console",
                                 false);
  } catch (const std::exception& error) {
    // Never put raw command arguments, user strings, tokens or IPs into logs.
    std::string reason = "execution_failed";
    const std::string message = error.what();
    if (message == "Not enough permissions to use this command")
      reason = "permission_denied";
    else if (message == "unknown_command" || message == "unknown_subcommand" ||
             message == "invalid_command" ||
             message == "invalid_argument_count" ||
             message == "invalid_form_id" || message == "invalid_item_count" ||
             message == "invalid_base_form")
      reason = message;
    world->consoleSecurity.Audit("console_command_denied", me.GetFormId(),
                                 command, reason, "native_console", true);
    throw;
  }
}
