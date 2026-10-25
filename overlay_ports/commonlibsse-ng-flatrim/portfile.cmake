vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO alandtse/CommonLibSSE-NG
    REF c5424463bba9af0d75cde8640ba7ddd4cacb9e39 # v7.5.4: Skyrim 1.7.104 and Address Library v5
    SHA512 7090a9f3c34930cd59d56dac6b35d86a6a74dad64161ad47f76556b0e49bfec8544f53e5d8abf70beee369ef8cfa70159823c1be42680cbb0958428c2074ed55
    HEAD_REF ng
    PATCHES
      patches/01-objectrefr-make_moverefr_public.patch
      patches/02-variable-make_members_public.patch
      patches/03-stackframe-uncomment_top_args.patch
      patches/04-extradatalist-make_members_public.patch
)

# CommonLib's instruction-boundary checks vendor this decoder. Resolve it through
# vcpkg so its configure step does not download an unchecked nested dependency.
vcpkg_from_github(
    OUT_SOURCE_PATH HDE64_SOURCE_PATH
    REPO TsudaKageyu/minhook
    REF v1.3.4
    SHA512 8a33233598b56ad9da44d22d470c2432f68364dac31bc719fcd6b085e681fa10ddd41865fbde056ee7f4e7a075cc135344b6bf444eadbd7e7314ee1bedfd89b5
    HEAD_REF master
)

vcpkg_cmake_configure(
        SOURCE_PATH "${SOURCE_PATH}"
        OPTIONS
          -DENABLE_SKYRIM_VR=OFF
          -DBUILD_TESTS=OFF
          -DSKSE_SUPPORT_XBYAK=ON
          -DCOMMONLIB_ENABLE_IPO=OFF
          -DCOMMONLIB_PREBUILT=OFF
          -DFETCHCONTENT_SOURCE_DIR_HDE64=${HDE64_SOURCE_PATH}
)

vcpkg_cmake_install()
vcpkg_cmake_config_fixup(PACKAGE_NAME CommonLibSSE CONFIG_PATH lib/cmake)
vcpkg_copy_pdbs()

file(GLOB CMAKE_CONFIGS "${CURRENT_PACKAGES_DIR}/share/CommonLibSSE/CommonLibSSE/*.cmake")
file(INSTALL ${CMAKE_CONFIGS} DESTINATION "${CURRENT_PACKAGES_DIR}/share/CommonLibSSE")
file(INSTALL "${SOURCE_PATH}/cmake/CommonLibSSE.cmake" DESTINATION "${CURRENT_PACKAGES_DIR}/share/CommonLibSSE")

file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/include")
file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/share/CommonLibSSE/CommonLibSSE")

vcpkg_install_copyright(FILE_LIST
    "${SOURCE_PATH}/COPYING.txt"
    "${SOURCE_PATH}/EXCEPTIONS.md"
    "${SOURCE_PATH}/licenses/LICENSE-MIT.txt"
    "${HDE64_SOURCE_PATH}/LICENSE.txt"
)
