import { prisma } from "@endgit/database";
import { dashboardService } from "../modules/dashboard/dashboard.service";
import { pluginsService } from "../modules/plugins/plugins.service";

export const resolvers = {
  Query: {
    plugins: async (
      _: any,
      args: { limit: number; offset: number; status?: string },
    ) => {
      return prisma.plugin.findMany({
        where: args.status ? { status: args.status as any } : undefined,
        take: args.limit,
        skip: args.offset,
        orderBy: { heatScore: "desc" },
      });
    },
    plugin: async (_: any, args: { slug: string }, context: any) => {
      return pluginsService.getBySlug(args.slug, context.user);
    },
    me: async (_: any, __: any, context: any) => {
      if (!context.user) return null;
      return prisma.user.findUnique({ where: { id: context.user.id } });
    },
    homePlugins: async () => {
      return pluginsService.getHome();
    },
    myPlugins: async (_: any, __: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      return dashboardService.getMyPlugins(context.user.id);
    },
    myStats: async (_: any, __: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      return dashboardService.getMyStats(context.user.id);
    },
    dashboardStatus: async (_: any, __: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      return dashboardService.getStatus(context.user.id);
    },
  },
  Mutation: {
    createPlugin: async (_: any, { input }: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      return pluginsService.createPlugin(input, context.user.id);
    },
    updatePlugin: async (_: any, { slug, input }: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      return pluginsService.updatePlugin(slug, input, context.user);
    },
    deletePlugin: async (_: any, { slug }: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      await pluginsService.deletePlugin(slug, context.user);
      return true;
    },
    triggerBuild: async (
      _: any,
      { slug, commitHash, branch }: any,
      context: any,
    ) => {
      if (!context.user) throw new Error("Unauthorized");
      return pluginsService.triggerBuild(
        slug,
        { commitHash, branch },
        context.user,
      );
    },
  },
  Plugin: {
    author: async (parent: any, _: any, context: any) => {
      if (parent.author) return parent.author;
      return context.loaders.userLoader.load(parent.authorId);
    },
    versions: async (parent: any, args: { status?: string }, context: any) => {
      let versions;
      if (parent.versions) {
        versions = parent.versions;
      } else {
        versions = await context.loaders.versionLoader.load(parent.id);
      }
      if (args.status) {
        return versions.filter((v: any) => v.status === args.status);
      }
      return versions;
    },
    stars: (parent: any) => parent.stars || 0,
    downloads: (parent: any) => parent.downloads || 0,
    commentCount: (parent: any) => parent.commentCount || 0,
    heatScore: (parent: any) => parent.heatScore || 0,
    status: (parent: any) => parent.status || "UNKNOWN",
    isVerified: (parent: any) => parent.isVerified || false,
    isFeatured: (parent: any) => parent.isFeatured || false,
    pluginType: (parent: any) => parent.pluginType || "UNKNOWN",
  },
};
