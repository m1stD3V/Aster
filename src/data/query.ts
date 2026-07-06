/**
 * Single GraphQL query for everything the galaxy renders.
 * GraphQL is point-billed per node, so this asks only for fields we map:
 * profile metrics plus the top 100 owned repos by stars.
 */
export const PROFILE_QUERY = `
query GalaxyProfile($login: String!) {
  user(login: $login) {
    login
    name
    avatarUrl
    createdAt
    followers { totalCount }
    repositories(
      first: 100
      ownerAffiliations: OWNER
      orderBy: { field: STARGAZERS, direction: DESC }
    ) {
      nodes {
        id
        name
        description
        stargazerCount
        forkCount
        isFork
        isArchived
        createdAt
        pushedAt
        primaryLanguage { name color }
      }
    }
  }
}
`;
