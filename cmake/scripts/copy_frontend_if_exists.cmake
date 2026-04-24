cmake_minimum_required(VERSION 3.15)

file(MAKE_DIRECTORY "${FRONTEND_UI_DIR}")

if(EXISTS "${FRONTEND_BUILD_JS}")
  file(COPY_FILE "${FRONTEND_BUILD_JS}" "${FRONTEND_UI_DIR}/build.js")
  message(STATUS "Copied ${FRONTEND_BUILD_JS} to ${FRONTEND_UI_DIR}/build.js")
else()
  message(STATUS "Frontend build.js not found at ${FRONTEND_BUILD_JS}, skipping UI copy. Build with BUILD_FRONT=ON or pre-build skymp5-front to include the admin UI.")
endif()
