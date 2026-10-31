#include "ScriptStorageFactory.h"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <map>
#include <vector>

namespace {
std::vector<std::filesystem::path> ListModFolders(
  const nlohmann::json& serverSettings, const std::string& dataDir)
{
  const auto root = std::filesystem::path(dataDir) / "mods";
  if (!std::filesystem::is_directory(root)) {
    return {};
  }

  std::vector<std::filesystem::path> folders;
  std::map<std::string, std::filesystem::path> remaining;
  for (const auto& entry : std::filesystem::directory_iterator(root)) {
    if (entry.is_directory()) {
      remaining[entry.path().filename().string()] = entry.path();
    }
  }

  if (serverSettings.contains("modFolders") &&
      serverSettings.at("modFolders").is_array()) {
    for (const auto& name : serverSettings.at("modFolders")) {
      auto it = name.is_string() ? remaining.find(name.get<std::string>())
                                 : remaining.end();
      if (it != remaining.end()) {
        folders.push_back(it->second);
        remaining.erase(it);
      }
    }
  }
  for (const auto& [name, folder] : remaining) {
    folders.push_back(folder);
  }
  return folders;
}

// Mods ship "Scripts" or "scripts", and Linux servers are case sensitive
std::filesystem::path FindScriptsDirectory(const std::filesystem::path& mod)
{
  for (const auto& entry : std::filesystem::directory_iterator(mod)) {
    auto name = entry.path().filename().string();
    std::transform(name.begin(), name.end(), name.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    if (entry.is_directory() && name == "scripts") {
      return entry.path();
    }
  }
  return {};
}
}

std::shared_ptr<IScriptStorage> ScriptStorageFactory::Create(
  nlohmann::json serverSettings)
{

  std::vector<std::shared_ptr<IScriptStorage>> scriptStorages;

  // TODO: ensure this order is correct
  AddDirectory(scriptStorages, serverSettings);
  AddBsa(scriptStorages, serverSettings);
  AddAssets(scriptStorages, serverSettings);

  return std::dynamic_pointer_cast<IScriptStorage>(
    std::make_shared<CombinedScriptStorage>(scriptStorages));
}

std::string ScriptStorageFactory::ResolveArchivePath(
  const std::string& pathFromConfigStr, const std::string& dataDir)
{
  std::filesystem::path pathFromConfig = pathFromConfigStr;

  if (pathFromConfig.is_absolute()) {
    return pathFromConfig.string();
  } else {
    return (dataDir / pathFromConfig).string();
  }
}

void ScriptStorageFactory::AddDirectory(
  std::vector<std::shared_ptr<IScriptStorage>>& storages,
  nlohmann::json& serverSettings)
{
  std::string dataDir = serverSettings["dataDir"];

  // CombinedScriptStorage takes the first match, and a later mod wins conflicts
  auto modFolders = ListModFolders(serverSettings, dataDir);
  for (auto it = modFolders.rbegin(); it != modFolders.rend(); ++it) {
    auto scripts = FindScriptsDirectory(*it);
    if (!scripts.empty()) {
      storages.push_back(
        std::make_shared<DirectoryScriptStorage>(scripts.string()));
    }
  }

  storages.push_back(std::make_shared<DirectoryScriptStorage>(
    (std::filesystem::path(dataDir) / "scripts").string()));
}

void ScriptStorageFactory::AddAssets(
  std::vector<std::shared_ptr<IScriptStorage>>& storages, nlohmann::json&)
{
  storages.push_back(std::make_shared<AssetsScriptStorage>());
}

void ScriptStorageFactory::AddBsa(
  std::vector<std::shared_ptr<IScriptStorage>>& storages,
  nlohmann::json& serverSettings)
{
  std::string dataDir = serverSettings["dataDir"];

  if (serverSettings.contains("archives") &&
      serverSettings.at("archives").is_array()) {
    for (auto& archive : serverSettings.at("archives")) {
      std::string archivePath =
        ResolveArchivePath(archive.get<std::string>(), dataDir);
      storages.push_back(
        std::make_shared<BsaArchiveScriptStorage>(archivePath.data()));
    }
  }
}
