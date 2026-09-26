export type { Database, Json } from "./database.types";
import type { Database } from "./database.types";

type PublicTables = Database["public"]["Tables"];
export type Row<T extends keyof PublicTables> = PublicTables[T]["Row"];
export type Insert<T extends keyof PublicTables> = PublicTables[T]["Insert"];
export type Update<T extends keyof PublicTables> = PublicTables[T]["Update"];
export type PlanTier = Database["public"]["Enums"]["plan_tier"];
