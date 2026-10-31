#include "NetworkingMock.h"
#include <catch2/catch_all.hpp>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

using namespace Networking;

TEST_CASE("Mock transport consumes rejected packets once and preserves "
          "following packets",
          "[Networking][ConsoleSecurity]")
{
  MockServer server;
  auto client = server.CreateClient().first;
  std::vector<std::string> received;
  auto onServerPacket = [](void* state, UserId, PacketType type,
                           PacketData bytes, size_t length) {
    if (type != PacketType::Message)
      return;
    auto& messages = *static_cast<std::vector<std::string>*>(state);
    messages.emplace_back(reinterpret_cast<const char*>(bytes), length);
    if (messages.back() == "bad")
      throw std::runtime_error("rejected fixture");
  };
  server.Tick(onServerPacket, &received);
  client->Send(reinterpret_cast<const uint8_t*>("before"), 6, true);
  client->Send(reinterpret_cast<const uint8_t*>("bad"), 3, true);
  client->Send(reinterpret_cast<const uint8_t*>("after"), 5, true);
  REQUIRE_THROWS(server.Tick(onServerPacket, &received));
  REQUIRE(received == std::vector<std::string>{ "before", "bad" });
  REQUIRE_NOTHROW(server.Tick(onServerPacket, &received));
  REQUIRE(received == std::vector<std::string>{ "before", "bad", "after" });
  server.Tick(onServerPacket, &received);
  REQUIRE(received.size() == 3);
}

TEST_CASE(
  "Mock client does not replay packets after a throwing receive handler",
  "[Networking][ConsoleSecurity]")
{
  MockServer server;
  auto [client, user] = server.CreateClient();
  std::vector<std::string> received;
  auto onClientPacket = [](void* state, PacketType type, PacketData bytes,
                           size_t length, const char*) {
    if (type != PacketType::Message)
      return;
    auto& messages = *static_cast<std::vector<std::string>*>(state);
    messages.emplace_back(reinterpret_cast<const char*>(bytes), length);
    if (messages.back() == "bad")
      throw std::runtime_error("rejected fixture");
  };
  client->Tick(onClientPacket, &received);
  server.Send(user, reinterpret_cast<const uint8_t*>("before"), 6, true);
  server.Send(user, reinterpret_cast<const uint8_t*>("bad"), 3, true);
  server.Send(user, reinterpret_cast<const uint8_t*>("after"), 5, true);
  REQUIRE_THROWS(client->Tick(onClientPacket, &received));
  REQUIRE(received == std::vector<std::string>{ "before", "bad" });
  REQUIRE_NOTHROW(client->Tick(onClientPacket, &received));
  REQUIRE(received == std::vector<std::string>{ "before", "bad", "after" });
  client->Tick(onClientPacket, &received);
  REQUIRE(received.size() == 3);
}

TEST_CASE("MockServer - IsConnected is always true for clients",
          "[Networking]")
{
  REQUIRE(MockServer().CreateClient().first->IsConnected());
}

TEST_CASE("MockServer - send message to server", "[Networking]")
{
  MockServer mockServer;
  auto cl = mockServer.CreateClient().first;
  cl->Send((uint8_t*)"abcd", 4, true);

  static bool received = false;

  mockServer.Tick(
    [](void* state, UserId userId, PacketType packetType, PacketData data,
       size_t length) {
      if (length == 4 && !memcmp(data, "abcd", 4)) {
        received = true;
      }
    },
    nullptr);
  REQUIRE(received);
}

TEST_CASE("MockServer - send message to client", "[Networking]")
{
  MockServer mockServer;
  auto cl0 = mockServer.CreateClient().first;
  auto cl1 = mockServer.CreateClient().first;
  auto cl2 = mockServer.CreateClient().first;
  cl1.reset();

  auto cl = mockServer.CreateClient().first;

  mockServer.Send(1, (uint8_t*)"abcd", 4, true);

  static bool received = false;

  cl->Tick(
    [](void* state, PacketType packetType, PacketData data, size_t length,
       const char* error) {
      if (length == 4 && !memcmp(data, "abcd", 4)) {
        received = true;
      }
    },
    nullptr);
  REQUIRE(received);
}

TEST_CASE("MockServer - send message to unexisting client", "[Networking]")
{
  REQUIRE_THROWS_WITH(MockServer().Send(0, nullptr, 9000, true),
                      Catch::Matchers::ContainsSubstring(
                        "No client with id 0 found on MockServer"));
}

TEST_CASE("MockServer - connect/disconnect", "[Networking]")
{
  MockServer mockServer;

  auto cl = mockServer.CreateClient().first;

  {
    static bool serverTicked = false;
    mockServer.Tick(
      [](void* state, UserId userId, PacketType packetType, PacketData data,
         size_t length) {
        serverTicked = true;
        REQUIRE(packetType == PacketType::ServerSideUserConnect);
        REQUIRE(userId == 0);
      },
      nullptr);
    REQUIRE(serverTicked);
  }

  static bool clientTicked = false;

  cl->Tick(
    [](void* state, PacketType packetType, PacketData data, size_t length,
       const char* error) {
      clientTicked = true;
      REQUIRE(packetType == PacketType::ClientSideConnectionAccepted);
    },
    nullptr);

  REQUIRE(clientTicked);

  cl.reset();
  {
    static bool serverTicked = false;
    mockServer.Tick(
      [](void* state, UserId userId, PacketType packetType, PacketData data,
         size_t length) {
        serverTicked = true;
        REQUIRE(packetType == PacketType::ServerSideUserDisconnect);
        REQUIRE(userId == 0);
      },
      nullptr);
    REQUIRE(serverTicked);
  }
}
