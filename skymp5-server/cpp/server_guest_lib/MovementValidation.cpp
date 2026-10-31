#include "MovementValidation.h"
#include "FormDesc.h"
#include "NiPoint3.h"
#include "PartOne.h"
#include "TeleportMessage2.h"
#include <nlohmann/json.hpp>
#include <string>
#include <cmath>

namespace MovementValidation {

bool Validate(PartOne& partOne, const NiPoint3& currentPos,
              const NiPoint3& currentRot, const FormDesc& currentCellOrWorld,
              const NiPoint3& newPos, const FormDesc& newCellOrWorld,
              Networking::UserId userId, MpActor* actor,
              const std::vector<std::string>& espmFiles, bool serverTeleport)
{
  constexpr float kSqrMaxDistance = 4096.f * 4096.f;

  PartOneSendTargetWrapper& sendTarget = partOne.GetSendTarget();
  auto& security = partOne.worldState.consoleSecurity;
  const bool finite = std::isfinite(newPos[0]) && std::isfinite(newPos[1]) && std::isfinite(newPos[2]);

  if (serverTeleport || !finite || currentCellOrWorld != newCellOrWorld ||
      (currentPos - newPos).SqrLength() >= kSqrMaxDistance) {
    if (actor) {
      security.movement.erase(actor->GetFormId());
      if (!serverTeleport) security.Audit("movement_rejected", actor->GetFormId(), "movement",
        !finite ? "non_finite_position" : currentCellOrWorld != newCellOrWorld ? "unauthorized_cell_change" : "position_jump", "movement", true);
    }

    // Not doing this to any NPCs at this moment, yet we might consider to
    bool isMe = actor && partOne.serverState.ActorByUser(userId) == actor;
    if (isMe) {
      TeleportMessage2 msg;
      msg.pos = { currentPos[0], currentPos[1], currentPos[2] };
      msg.rot = { currentRot[0], currentRot[1], currentRot[2] };
      msg.worldOrCell = currentCellOrWorld.ToFormId(espmFiles);
      sendTarget.Send(userId, msg, true);
    }
    return false;
  }
  const bool isMe = actor && partOne.serverState.ActorByUser(userId) == actor;
  if (isMe && security.policy.monitorMovement && security.policy.movementEnforcement != "off") {
    const auto now = std::chrono::steady_clock::now();
    const auto actorId = actor->GetFormId();
    const auto allowance = security.movementAllowances.find(actorId);
    const bool exempt = allowance != security.movementAllowances.end() && allowance->second.until > now;
    if (allowance != security.movementAllowances.end() && !exempt) security.movementAllowances.erase(allowance);
    const std::array<float, 3> position = { newPos[0], newPos[1], newPos[2] };
    const auto sample = security.movement.find(actorId);
    if (!exempt && sample != security.movement.end()) {
      const auto observation = ConsoleSecurity::ObserveMovement(sample->second, position, now);
      if (observation) security.Audit("movement_observation", actorId, "movement", *observation, "movement", false);
    }
    if (sample == security.movement.end() || now - sample->second.at >= std::chrono::milliseconds(250)) {
      if (security.movement.size() >= 4096 && sample == security.movement.end()) security.movement.erase(security.movement.begin());
      security.movement[actorId] = { now, position };
    }
  }
  return true;
}

} // namespace MovementValidation
