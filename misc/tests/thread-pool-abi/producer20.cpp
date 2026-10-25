#include "ThreadPoolWrapper.h"
#include <atomic>
#include <stdexcept>
extern "C" void* create_remote_pool() { return new ThreadPoolWrapper(3); }
extern "C" size_t remote_wrapper_size() { return sizeof(ThreadPoolWrapper); }
std::future<void> remote_submit(void* opaque, std::atomic<int>& count) {
  return static_cast<ThreadPoolWrapper*>(opaque)->Push([&count] { ++count; });
}
std::future<void> remote_throw(void* opaque) {
  return static_cast<ThreadPoolWrapper*>(opaque)->Push([] { throw std::runtime_error("expected test error"); });
}
extern "C" void destroy_remote_pool(void* opaque) { delete static_cast<ThreadPoolWrapper*>(opaque); }
