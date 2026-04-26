-- AlterTable
ALTER TABLE "Location"
ADD COLUMN     "maxServers" INTEGER,
ADD COLUMN     "latencyCheckUrl" TEXT;

-- AlterTable
ALTER TABLE "Server"
ADD COLUMN     "locationUuid" TEXT;
