/** Every cloud GraphQL call goes here and is answered by ./cloud-mock.ts. Its own module so specs never import the Playwright config. */
export const CLOUD_URL = 'http://cloud.e2e.test/graphql'
