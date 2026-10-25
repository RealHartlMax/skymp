#pragma once
#include <cstdint>
#include <cstring>
#include <limits>
#include <mutex>
#include <vector>

// CEF owns its paint thread. D3D resources belong exclusively to the render thread.
class CefFrameBuffer
{
public:
  bool Store(const void* pixels, int width, int height)
  {
    if (!pixels || width <= 0 || height <= 0 || width > 8192 || height > 8192 ||
        static_cast<size_t>(width) * height > 32 * 1024 * 1024) return false;
    const auto bytes = static_cast<size_t>(width) * height * 4;
    std::lock_guard lock(m_mutex);
    m_pixels.resize(bytes);
    std::memcpy(m_pixels.data(), pixels, bytes);
    m_width = width;
    m_height = height;
    return true;
  }

  bool HasFrame(int width, int height)
  {
    std::lock_guard lock(m_mutex);
    return !m_pixels.empty() && m_width == width && m_height == height;
  }

  bool CopyTo(void* destination, size_t rowPitch, int width, int height)
  {
    std::lock_guard lock(m_mutex);
    if (!destination || m_pixels.empty() || width != m_width || height != m_height ||
        rowPitch < static_cast<size_t>(width) * 4 ||
        rowPitch > (std::numeric_limits<size_t>::max)() / static_cast<size_t>(height)) return false;
    auto output = static_cast<uint8_t*>(destination);
    const auto rowBytes = static_cast<size_t>(width) * 4;
    for (int row = 0; row < height; ++row) {
      std::memcpy(output + static_cast<size_t>(row) * rowPitch,
                  m_pixels.data() + static_cast<size_t>(row) * rowBytes, rowBytes);
    }
    m_pixels.clear();
    return true;
  }

private:
  std::mutex m_mutex;
  std::vector<uint8_t> m_pixels;
  int m_width = 0, m_height = 0;
};
