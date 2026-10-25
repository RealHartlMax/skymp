#pragma once

#include <memory>
#include <type_traits>

namespace SkyrimPlatformRuntime {
// CommonLibSSE-NG 7.5.4's out-of-line GetTintList() still uses the pre-1.7
// absolute offsets. GetPlayerRuntimeData() already accounts for the 1.7.99
// base-class shift. Keep base-array and overlay semantics, without guessing
// new absolute offsets or treating an embedded BSTArray as a pointer.
template <class Player>
[[nodiscard]] auto GetPlayerTintList(Player* player)
  -> std::remove_reference_t<
    decltype(player->GetPlayerRuntimeData().tintMasks)>*
{
  if (!player) {
    return nullptr;
  }
  auto& data = player->GetPlayerRuntimeData();
  return data.overlayTintMasks ? data.overlayTintMasks :
                                std::addressof(data.tintMasks);
}
}
