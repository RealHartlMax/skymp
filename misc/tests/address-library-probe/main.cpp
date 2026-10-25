// Read the installed address databases with the same CommonLib used by SkyMP.
// This is a standalone console check: no game, SKSE loader, or server is started.
#include <SKSE/Impl/PCH.h>
#include <REL/IDDB.h>

#include <fstream>
#include <iostream>

struct DatabaseCheck
{
  REL::Version version;
  int format;
  std::uint64_t consoleId;
  const wchar_t* filename;
};

int wmain(int argc, wchar_t** argv)
{
  try {
    if (argc != 2) {
      throw std::runtime_error("Usage: address-library-probe.exe SKYRIM_GAME_FOLDER");
    }
    const auto plugins = std::filesystem::path(argv[1]) / L"Data/SKSE/Plugins";
    const DatabaseCheck checks[] = {
      { { 1, 5, 97, 0 }, 1, 50180, L"version-1-5-97-0.bin" },
      { { 1, 6, 1170, 0 }, 2, 51110, L"versionlib-1-6-1170-0.bin" },
      { { 1, 7, 104, 0 }, 5, 51110, L"versionlib-1-7-104-0.bin" },
    };
    for (const auto& check : checks) {
      const auto database = plugins / check.filename;
      std::ifstream file(database, std::ios::binary);
      std::int32_t format = 0;
      if (!file.read(reinterpret_cast<char*>(&format), sizeof(format)) ||
          format != check.format) {
        throw std::runtime_error("Missing or unexpected address database format");
      }
      if (!REL::Module::mock(check.version)) {
        throw std::runtime_error("Could not create the isolated runtime context");
      }
      const bool expectAE = check.version[1] >= 6;
      if (REL::Module::IsAE() != expectAE ||
          REL::Module::IsSE() == expectAE) {
        throw std::runtime_error("Wrong CommonLib runtime classification");
      }
      // Auto-detect the actual format, as in a real plugin load.
      if (!REL::IDDB::inject(database.wstring(), check.version)) {
        throw std::runtime_error("CommonLib could not read the address database");
      }
      const auto consoleRva = REL::IDDB::get().id2offset(check.consoleId);
      if (consoleRva == 0) {
        throw std::runtime_error("Console address lookup returned an empty offset");
      }
      if (check.format == 5) {
        // Check the reader against the file's independent dense-array entry.
        file.clear();
        file.seekg(96 + check.consoleId * sizeof(std::uint32_t));
        std::uint32_t expectedRva = 0;
        if (!file.read(reinterpret_cast<char*>(&expectedRva), sizeof(expectedRva)) ||
            expectedRva != consoleRva) {
          throw std::runtime_error("Format-5 lookup differs from the on-disk entry");
        }
      }
      std::cout << "{\"version\":\"" << check.version.string(".")
                << "\",\"format\":" << format
                << ",\"runtime\":\"" << (expectAE ? "AE" : "SE")
                << "\",\"consoleRva\":" << consoleRva
                << ",\"ok\":true}\n";
      REL::Module::reset();
    }
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
