#include "ThreadPoolWrapper.h"

#include <BS_thread_pool.hpp>
#include <mutex>

struct ThreadPoolWrapper::Impl
{
  explicit Impl(int32_t numThreads_)
    : numThreads(numThreads_)
  {
  }

  const int32_t numThreads;
  std::mutex initMutex;
  // Join workers before destroying the initialization guard.
  std::unique_ptr<BS::light_thread_pool> pool;
};

ThreadPoolWrapper::ThreadPoolWrapper(int32_t numThreads_)
  : pImpl(std::make_unique<Impl>(numThreads_))
{
}

ThreadPoolWrapper::~ThreadPoolWrapper() = default;

std::future<void> ThreadPoolWrapper::Push(const std::function<void()>& task)
{
  {
    std::lock_guard lock(pImpl->initMutex);
    if (!pImpl->pool) {
      pImpl->pool =
        std::make_unique<BS::light_thread_pool>(pImpl->numThreads);
    }
  }
  return pImpl->pool->submit_task(task);
}

void ThreadPoolWrapper::PushAndWait(const std::function<void()>& task)
{
  Push(task).wait();
}
