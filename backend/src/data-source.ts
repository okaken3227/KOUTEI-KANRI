import { DataSource } from "typeorm";
import { User } from "./entity/User";
import { RiceField } from "./entity/RiceField";
import { WorkRecord } from "./entity/WorkRecord";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: [User, RiceField, WorkRecord],
  migrations: [],
  subscribers: [],
});



