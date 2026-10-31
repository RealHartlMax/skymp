#pragma once

#include <iomanip>
#include <sstream>
#include <string>
#include <vector>

namespace ConsoleCommandParser {
struct Result
{
  std::string commandName;
  std::vector<std::string> params;
};

inline Result Parse(const std::string& command)
{
  Result result;
  std::istringstream input(command);
  if (!(input >> result.commandName))
    return result;

  // Only a prefix on the command token is a selected reference/player.
  // A decimal point in a later argument is never a reference separator.
  const auto separator = result.commandName.find('.');
  if (separator != std::string::npos)
    result.commandName.erase(0, separator + 1);

  std::string argument;
  while (input >> std::quoted(argument))
    result.params.push_back(argument);
  return result;
}
}
