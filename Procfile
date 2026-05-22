web: pnpm start
release: export DATABASE_URL=${AZURE_DATABASE_URL:-$DATABASE_URL} && npx prisma@5 db push --schema=packages/database/prisma/schema.prisma --accept-data-loss
