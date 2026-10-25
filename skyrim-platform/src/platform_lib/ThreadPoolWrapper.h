#pragma once
#include <cstdint>
#include <functional>
#include <future>
#include <memory>

class ThreadPoolWrapper
{
public:
  ThreadPoolWrapper(int32_t numThreads_ = 1);
  ~ThreadPoolWrapper();

  ThreadPoolWrapper(const ThreadPoolWrapper&) = delete;
  ThreadPoolWrapper& operator=(const ThreadPoolWrapper&) = delete;

  std::future<void> Push(const std::function<void()>& task);
  void PushAndWait(const std::function<void()>& task);

private:
  // BS::thread_pool changes layout between C++20 and C++23. Keep its types and
  // inline template definitions in one translation unit; consumers use both
  // language modes in the native client.
  struct Impl;
  std::unique_ptr<Impl> pImpl;
};
