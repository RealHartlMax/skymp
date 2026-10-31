#include "ConsoleSecurity.h"
#include "../skyrim-platform/src/platform_se/skyrim_platform/ConsoleCommandParser.h"
#include "ActionListener.h"
#include "ChangeValuesMessage.h"
#include "ConsoleCommandMessage.h"
#include "MovementValidation.h"
#include "RawMessageData.h"
#include "TestUtils.hpp"
#include "UpdateMovementMessage.h"
#include <algorithm>
#include <catch2/catch_all.hpp>
#include <limits>

extern PartOne& GetPartOne();
using Argument = ConsoleCommands::Argument;

TEST_CASE(
  "Native console tokenization preserves zero-argument commands and decimals",
  "[ConsoleSecurity]")
{
  for (const auto& line :
       { "tgm", "TGM", "player.tgm", "00000014.tgm", " \ttgm \r\n" }) {
    const auto parsed = ConsoleCommandParser::Parse(line);
    REQUIRE((parsed.commandName == "tgm" || parsed.commandName == "TGM"));
    REQUIRE(parsed.params.empty());
  }
  const auto decimal =
    ConsoleCommandParser::Parse(" player.setav\thealth 0.5 ");
  REQUIRE(decimal.commandName == "setav");
  REQUIRE(decimal.params == std::vector<std::string>{ "health", "0.5" });
  const auto quoted = ConsoleCommandParser::Parse("player.mp \"disable\"");
  REQUIRE(quoted.commandName == "mp");
  REQUIRE(quoted.params == std::vector<std::string>{ "disable" });
  REQUIRE(ConsoleCommandParser::Parse(" \t ").commandName.empty());
}

TEST_CASE("Console Security defaults and legacy bypass are safe",
          "[ConsoleSecurity]")
{
  const auto defaults = ConsoleSecurity::Parse(nlohmann::json::object());
  REQUIRE(defaults.policy.mode == "restricted");
  REQUIRE(defaults.policy.blockVanillaCheats);
  REQUIRE(defaults.policy.blockUnauthorizedServerCommands);
  REQUIRE(defaults.policy.movementEnforcement == "monitor");
  auto legacy =
    ConsoleSecurity::Parse({ { "enableConsoleCommandsForAll", true } });
  REQUIRE(legacy.policy.mode == "restricted");
  REQUIRE(legacy.diagnostics ==
          std::vector<std::string>{ "LEGACY_CONSOLE_BYPASS_IGNORED" });
  auto invalid = ConsoleSecurity::Parse(
    { { "consoleSecurity",
        { { "mode", "anything" },
          { "blockVanillaCheats", false },
          { "blockUnauthorizedServerCommands", false } } } });
  REQUIRE(invalid.policy.blockVanillaCheats);
  REQUIRE(invalid.policy.blockUnauthorizedServerCommands);
  REQUIRE(invalid.diagnostics.size() == 3);
  auto development = ConsoleSecurity::Parse(
    { { "consoleSecurity",
        { { "mode", "development" }, { "blockVanillaCheats", false } } } });
  REQUIRE_FALSE(development.policy.blockVanillaCheats);
  REQUIRE(development.policy.blockUnauthorizedServerCommands);
  auto savedEnforce = ConsoleSecurity::Parse(
    { { "consoleSecurity", { { "movementEnforcement", "enforce" } } } });
  REQUIRE(savedEnforce.policy.movementEnforcement == "monitor");
  REQUIRE(savedEnforce.diagnostics.empty());
}

TEST_CASE("Console Security validates every argument before execution",
          "[ConsoleSecurity]")
{
  REQUIRE(ConsoleSecurity::ValidateRequest(
            "AddItem", { Argument(0x14), Argument(0x12eb7), Argument(1) })
            .command == "additem");
  REQUIRE(ConsoleSecurity::ValidateRequest(
            "MP", { Argument(0x14), Argument(std::string("DISABLE")) })
            .command == "disable");
  for (const auto& name :
       { "tgm", "player.additem", "additem;disable", "/help", "unregistered" })
    REQUIRE_THROWS(ConsoleSecurity::ValidateRequest(name, {}));
  REQUIRE_THROWS(ConsoleSecurity::ValidateRequest(
    "mp", { Argument(0x14), Argument(std::string("anything")) }));
  REQUIRE_THROWS(
    ConsoleSecurity::ValidateRequest("additem", { Argument(0x14) }));
  REQUIRE_THROWS(
    ConsoleSecurity::ValidateRequest("disable", { Argument(-1) }));
  REQUIRE_THROWS(ConsoleSecurity::ValidateRequest(
    "disable", { Argument(int64_t(0x100000014ULL)) }));
  REQUIRE_THROWS(ConsoleSecurity::ValidateRequest(
    "disable", { Argument(std::string("14")) }));
  for (const auto count : { int64_t(-1), int64_t(0), int64_t(1000001),
                            std::numeric_limits<int64_t>::max() })
    REQUIRE_THROWS(ConsoleSecurity::ValidateRequest(
      "additem", { Argument(0x14), Argument(1), Argument(count) }));
}

namespace {
struct ActorFixture
{
  PartOne& part = GetPartOne();
  const uint32_t actorId = 0xff0c0001;
  ConsoleSecurity::State saved = std::move(part.worldState.consoleSecurity);
  ActorFixture()
  {
    part.worldState.consoleSecurity = {};
    DoConnect(part, 0);
    part.CreateActor(actorId, { 0, 0, 0 }, 0, 0x3c);
    part.SetUserActor(0, actorId);
  }
  ~ActorFixture()
  {
    part.DestroyActor(actorId);
    DoDisconnect(part, 0);
    part.worldState.consoleSecurity = std::move(saved);
  }
  MpActor& Actor() { return part.worldState.GetFormAt<MpActor>(actorId); }
};
}

TEST_CASE("Native command permission ignores development mode",
          "[ConsoleSecurity]")
{
  ActorFixture fixture;
  auto& actor = fixture.Actor();
  fixture.part.worldState.consoleSecurity.policy.mode = "development";
  REQUIRE_FALSE(
    ConsoleSecurity::IsAuthorized(actor, "additem", actor.GetFormId()));
  actor.SetConsoleCommandsAllowedFlag(true);
  REQUIRE(ConsoleSecurity::IsAuthorized(actor, "additem", actor.GetFormId()));
  fixture.part.worldState.consoleSecurity.authorizer =
    [](const MpActor&, const std::string&, uint32_t) -> std::optional<bool> {
    return false;
  };
  REQUIRE_FALSE(
    ConsoleSecurity::IsAuthorized(actor, "additem", actor.GetFormId()));
  fixture.part.worldState.consoleSecurity.authorizer =
    [](const MpActor&, const std::string&, uint32_t) -> std::optional<bool> {
    throw std::runtime_error("provider failure");
  };
  REQUIRE_FALSE(
    ConsoleSecurity::IsAuthorized(actor, "additem", actor.GetFormId()));
}

TEST_CASE(
  "Unauthorized and malformed ConsoleCommands have no inventory side effects",
  "[ConsoleSecurity]")
{
  ActorFixture fixture;
  auto& actor = fixture.Actor();
  const auto before = actor.GetInventory();
  RawMessageData raw;
  raw.userId = 0;
  ConsoleCommandMessage command;
  command.data.commandName = "additem";
  command.data.args = { int64_t(0x14), int64_t(0x12eb7), int64_t(1) };
  REQUIRE_THROWS(
    fixture.part.GetActionListener().OnConsoleCommand(raw, command));
  actor.SetConsoleCommandsAllowedFlag(true);
  command.data.args[2] = int64_t(-1);
  REQUIRE_THROWS(
    fixture.part.GetActionListener().OnConsoleCommand(raw, command));
  REQUIRE(actor.GetInventory() == before);
}

TEST_CASE(
  "Movement monitoring observes speed without claiming collision detection",
  "[ConsoleSecurity]")
{
  using Clock = std::chrono::steady_clock;
  const auto now = Clock::now();
  ConsoleSecurity::MovementSample previous{
    now - std::chrono::milliseconds(500), { 0.f, 0.f, 0.f }
  };
  REQUIRE_FALSE(
    ConsoleSecurity::ObserveMovement(previous, { 100.f, 0.f, 0.f }, now));
  REQUIRE_FALSE(
    ConsoleSecurity::ObserveMovement(previous, { 600.f, 0.f, -500.f }, now));
  REQUIRE(ConsoleSecurity::ObserveMovement(previous, { 2000.f, 0.f, 0.f },
                                           now) == "speed_observation");
  REQUIRE(ConsoleSecurity::ObserveMovement(previous, { 0.f, 0.f, 1200.f },
                                           now) == "vertical_observation");
  REQUIRE_FALSE(ConsoleSecurity::ObserveMovement(
    previous, { 3000.f, 0.f, 0.f }, now + std::chrono::seconds(4)));
}

TEST_CASE("Monitoring and enforcement preserve validated movement and server "
          "teleports",
          "[ConsoleSecurity]")
{
  ActorFixture fixture;
  auto& actor = fixture.Actor();
  auto& state = fixture.part.worldState.consoleSecurity;
  for (const auto& mode : { "off", "monitor" }) {
    state.policy.movementEnforcement = mode;
    state.movement[actor.GetFormId()] = { std::chrono::steady_clock::now() -
                                            std::chrono::milliseconds(500),
                                          { 0.f, 0.f, 0.f } };
    fixture.part.Messages().clear();
    REQUIRE(MovementValidation::Validate(
      fixture.part, { 0, 0, 0 }, { 0, 0, 0 }, FormDesc::Tamriel(),
      { 2000, 0, 0 }, FormDesc::Tamriel(), 0, &actor, { "Skyrim.esm" }));
    REQUIRE(fixture.part.Messages().empty());
  }
  fixture.part.Messages().clear();
  REQUIRE_FALSE(MovementValidation::Validate(
    fixture.part, { 0, 0, 0 }, { 0, 0, 0 }, FormDesc::Tamriel(),
    { std::numeric_limits<float>::quiet_NaN(), 0, 0 }, FormDesc::Tamriel(), 0,
    &actor, { "Skyrim.esm" }));
  REQUIRE(fixture.part.Messages().size() == 1);
  fixture.part.Messages().clear();
  REQUIRE_FALSE(MovementValidation::Validate(
    fixture.part, { 1, 2, 3 }, { 0, 0, 0 }, FormDesc::Tamriel(), { 0, 0, 0 },
    FormDesc::Tamriel(), 0, &actor, { "Skyrim.esm" }, true));
  REQUIRE(fixture.part.Messages().size() == 1);
  REQUIRE(state.movement.count(actor.GetFormId()) == 0);
}

TEST_CASE("Invalid attribute packets cannot partially mutate the actor",
          "[ConsoleSecurity]")
{
  ActorFixture fixture;
  auto& actor = fixture.Actor();
  const auto before = actor.GetChangeForm().actorValues;
  RawMessageData raw;
  raw.userId = 0;
  for (const float invalid :
       { -0.01f, 1.01f, std::numeric_limits<float>::infinity(),
         std::numeric_limits<float>::quiet_NaN() }) {
    ChangeValuesMessage values;
    values.data.health = 0.25f;
    values.data.magicka = invalid;
    values.data.stamina = 0.5f;
    fixture.part.GetActionListener().OnChangeValues(raw, values);
    const auto after = actor.GetChangeForm().actorValues;
    REQUIRE(after.healthPercentage == before.healthPercentage);
    REQUIRE(after.magickaPercentage == before.magickaPercentage);
    REQUIRE(after.staminaPercentage == before.staminaPercentage);
  }
}

TEST_CASE("Rejected movement is neither applied nor relayed to a neighbour",
          "[ConsoleSecurity]")
{
  ActorFixture fixture;
  auto& part = fixture.part;
  auto& actor = fixture.Actor();
  struct Peer
  {
    PartOne& part;
    uint32_t id;
    Peer(PartOne& part_, uint32_t id_)
      : part(part_)
      , id(id_)
    {
      DoConnect(part, 1);
      part.CreateActor(id, { 1, 0, 0 }, 0, 0x3c);
      part.SetUserActor(1, id);
    }
    ~Peer()
    {
      part.DestroyActor(id);
      DoDisconnect(part, 1);
    }
  } peer(part, fixture.actorId + 1);
  const auto& listeners = actor.GetActorListeners();
  REQUIRE(std::find(listeners.begin(), listeners.end(),
                    &part.worldState.GetFormAt<MpActor>(peer.id)) !=
          listeners.end());
  auto packetObject = jMovement;
  packetObject["idx"] = actor.GetIdx();
  packetObject["data"]["pos"] = { 1.f, 0.f, 0.f };
  packetObject["data"]["rot"] = { 0.f, 0.f, 0.f };
  const auto packet = MakeMessage(packetObject);
  RawMessageData raw;
  raw.userId = 0;
  raw.unparsed = reinterpret_cast<Networking::PacketData>(packet.data());
  raw.unparsedLength = packet.size();
  UpdateMovementMessage movement;
  movement.idx = actor.GetIdx();
  movement.data.worldOrCell = 0x3c;
  movement.data.pos = { 6000, 0, 0 };
  movement.data.isMounted = true;
  movement.data.mountRemoteId = 0xff000123;
  part.Messages().clear();
  part.GetActionListener().OnUpdateMovement(raw, movement);
  REQUIRE(actor.GetPos().x == 0);
  REQUIRE(part.worldState.ridingHorseByRider.count(actor.GetFormId()) == 0);
  REQUIRE(part.Messages().size() == 1);
  REQUIRE(part.Messages().front().userId == 0);
  REQUIRE(part.Messages().front().j.at("t") ==
          static_cast<int>(MsgType::Teleport2));

  movement.data.pos = { 1, 0, 0 };
  movement.data.rot[0] = std::numeric_limits<float>::quiet_NaN();
  part.Messages().clear();
  part.GetActionListener().OnUpdateMovement(raw, movement);
  REQUIRE(actor.GetPos().x == 0);
  REQUIRE(part.Messages().empty());

  movement.data.rot[0] = 0;
  movement.data.isMounted = false;
  movement.data.mountRemoteId = std::nullopt;
  part.Messages().clear();
  part.GetActionListener().OnUpdateMovement(raw, movement);
  REQUIRE(actor.GetPos().x == 1);
  REQUIRE(
    std::any_of(part.Messages().begin(), part.Messages().end(),
                [](const auto& message) { return message.userId == 1; }));
}
