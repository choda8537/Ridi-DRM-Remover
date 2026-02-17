declare const BUILD_VERSION: string
declare const BUILD_TIME: string
declare const GIT_COMMIT: string

export const APP_VERSION =
  typeof BUILD_VERSION !== 'undefined'
    ? `${BUILD_VERSION} (${GIT_COMMIT} / ${BUILD_TIME})`
    : 'dev'
