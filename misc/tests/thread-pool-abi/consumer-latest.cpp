#include "ThreadPoolWrapper.h"
#include <Windows.h>
#include <atomic>
#include <cstdio>
#include <stdexcept>
#include <thread>
#include <vector>
extern "C" void* create_remote_pool();
extern "C" size_t remote_wrapper_size();
extern "C" void destroy_remote_pool(void*);
std::future<void> remote_submit(void*, std::atomic<int>&);
std::future<void> remote_throw(void*);
int main() {
  SetErrorMode(SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS);
  std::printf("wrapper sizeof C++20=%zu, latest=%zu\n",remote_wrapper_size(),sizeof(ThreadPoolWrapper));std::fflush(stdout);
  ThreadPoolWrapper local(1);
  std::atomic<int> localCount{0};local.PushAndWait([&] {++localCount;});
  if(localCount!=1)return 10;
  void* remote=create_remote_pool();std::atomic<int> total{0};
  std::vector<std::thread> producers;
  for(int i=0;i<8;i++)producers.emplace_back([&] {
    std::vector<std::future<void>> work;
    for(int j=0;j<125;j++)work.push_back(remote_submit(remote,total));
    for(auto& future:work)future.get();
  });
  for(auto& thread:producers)thread.join();
  if(total!=1000)return 11;
  bool threw=false;try {remote_throw(remote).get();} catch(const std::runtime_error&) {threw=true;}
  if(!threw)return 12;
  for(int i=0;i<400;i++)remote_submit(remote,total);
  destroy_remote_pool(remote);
  if(total!=1400)return 13;
  std::printf("PASS: mixed C++20/latest consumers, concurrent lazy creation, 1400 tasks, future exception, destructor joins\n");
}
