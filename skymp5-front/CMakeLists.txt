project(skymp5-front LANGUAGES NONE)

if(BUILD_FRONT)
  # The fork owns its CEF sources. Never replace them with a separate upstream
  # checkout, which would drop local chat/client integration from a release.
  find_program(SKYMP_FRONT_NODE_EXECUTABLE node REQUIRED)
  if(NOT EXISTS "${CMAKE_CURRENT_LIST_DIR}/node_modules/webpack/package.json")
    include("${CMAKE_CURRENT_LIST_DIR}/../cmake/package_manager.cmake")
    npm_execute_command(WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}" COMMAND ci)
  endif()
  add_custom_target(skymp5-front ALL
    COMMAND "${SKYMP_FRONT_NODE_EXECUTABLE}" "${CMAKE_CURRENT_LIST_DIR}/scripts/build.cjs"
            --mode production --output "${CMAKE_BINARY_DIR}/dist/client/Data/Platform/UI"
    WORKING_DIRECTORY "${CMAKE_CURRENT_LIST_DIR}"
    COMMENT "Building this fork's local CEF frontend"
    VERBATIM
  )
else()
  add_custom_target(skymp5-front ALL
    COMMAND ${CMAKE_COMMAND} -E echo "Building skymp5-front is disabled. To enable it, set BUILD_FRONT to ON."
  )
endif()
