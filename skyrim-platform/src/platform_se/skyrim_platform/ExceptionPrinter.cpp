#include "ExceptionPrinter.h"
#include "ConsoleApi.h"
#include "IConsolePrinter.h"
#include <spdlog/spdlog.h>

// ConsoleApi.cpp
extern std::shared_ptr<IConsolePrinter> g_printer;
extern std::shared_ptr<IConsolePrinter> g_windowsConsolePrinter;

const char* ExceptionPrinter::RemoveMultiplePrefixes(const char* str,
                                                     const char* prefix)
{
  size_t prefixLen = strlen(prefix);
  size_t strLen = strlen(str);
  while (strLen >= prefixLen && !memcmp(str, prefix, prefixLen)) {
    str += prefixLen;
    strLen -= prefixLen;
  }
  return str;
}

void ExceptionPrinter::Print(const std::exception& e)
{
  const std::string message = RemoveMultiplePrefixes(e.what(), "Error: ");
  const std::string prefix = ConsoleApi::GetExceptionPrefix();
  spdlog::error("Platform script error: {}", message);
  // Script callbacks run on the JS worker; Skyrim console calls belong to the game thread.
  if (auto tasks = SKSE::GetTaskInterface()) {
    tasks->AddTask([message, prefix] {
      ExceptionPrinter(prefix.c_str()).PrintException(message.c_str());
    });
  }
}

ExceptionPrinter::ExceptionPrinter(const char* exceptionPrefix_)
  : exceptionPrefix(exceptionPrefix_)
{
}

void ExceptionPrinter::PrintException(const char* what)
{
  std::string tmp;

  auto console = RE::ConsoleLog::GetSingleton();
  if (!console || !g_printer) {
    return;
  }

  size_t i = 0;

  auto safePrint = [what, console, &i](std::string msg) {
    if (msg.size() > 128) {
      msg.resize(128);
      msg += '...';
    }
    const char* prefix = ConsoleApi::GetExceptionPrefix();

    if (i > 0) {
      g_printer->PrintRaw(msg.data());
    } else {
      msg = std::string(prefix) + msg;
      g_printer->PrintRaw(msg.data());
    }

    if (g_windowsConsolePrinter) {
      g_windowsConsolePrinter->PrintRaw(msg.data());
    }

    ++i;
  };

  for (size_t i = 0, n = strlen(what); i < n; ++i) {
    if (what[i] == '\n') {
      safePrint(tmp);
      tmp.clear();
    } else {
      tmp += what[i];
    }
  }
  if (!tmp.empty()) {
    safePrint(tmp);
  }
}
