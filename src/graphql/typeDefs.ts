export const typeDefs = `#graphql
  type User {
    id: ID!
    githubId: String!
    username: String!
    displayName: String
    email: String
    avatarUrl: String
    bio: String
    trustLevel: String!
    trustScore: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Producer {
    githubUser: String!
    role: String!
  }

  type VirusTotal {
    scanId: String
    status: String
    malicious: Int
    suspicious: Int
    undetected: Int
    total: Int
    permalink: String
    scanDate: String
  }

  type Version {
    id: ID!
    version: String!
    changelog: String
    longDescription: String
    fileName: String!
    fileSize: Int!
    fileHash: String!
    minApiVersion: String
    supportedApis: [String!]!
    downloads: Int!
    isLatest: Boolean!
    isPreRelease: Boolean!
    status: String!
    statusReason: String
    createdAt: String!
    producers: [Producer!]
    virustotal: VirusTotal
  }

  type Plugin {
    id: ID!
    name: String!
    slug: String!
    displayName: String!
    description: String!
    longDescription: String
    iconUrl: String
    repoUrl: String
    license: String
    tags: [String!]!
    keywords: [String!]!
    pluginType: String!
    downloads: Int!
    stars: Int!
    commentCount: Int!
    heatScore: Int!
    status: String!
    qualityBadge: String!
    isVerified: Boolean!
    isFeatured: Boolean!
    createdAt: String!
    updatedAt: String!
    author: User!
    versions(status: String): [Version!]!
    latestVersion: String
    isPreRelease: Boolean
  }

  type HomePlugins {
    hotPlugins: [Plugin!]!
    newPlugins: [Plugin!]!
    topPlugins: [Plugin!]!
    featuredPlugins: [Plugin!]!
  }

  type DashboardStats {
    totalPlugins: Int!
    totalDownloads: Int!
    totalVersions: Int!
    pendingReviews: Int!
  }

  type Quota {
    used: Int!
    limit: Int!
    resetsAt: String!
  }

  type DashboardStatus {
    hasAppInstalled: Boolean!
    githubTokenExpired: Boolean!
    quota: Quota!
  }

  type Query {
    plugins(limit: Int = 10, offset: Int = 0, status: String): [Plugin!]!
    plugin(slug: String!): Plugin
    me: User
    homePlugins: HomePlugins!
    myPlugins: [Plugin!]!
    myStats: DashboardStats!
    dashboardStatus: DashboardStatus!
  }

  input CreatePluginInput {
    name: String!
    displayName: String!
    description: String!
    longDescription: String
    pluginType: String
    repoUrl: String
    license: String
    tags: [String!]
  }

  input UpdatePluginInput {
    displayName: String
    description: String
    longDescription: String
    iconUrl: String
    license: String
    tags: [String!]
    isPreRelease: Boolean
  }

  type Mutation {
    createPlugin(input: CreatePluginInput!): Plugin!
    updatePlugin(slug: String!, input: UpdatePluginInput!): Plugin!
    deletePlugin(slug: String!): Boolean!
    triggerBuild(slug: String!, commitHash: String, branch: String): String!
  }
`;
