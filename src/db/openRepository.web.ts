import { MemoryRepository } from "@/db/memoryRepository";
import type { Repository } from "@/db/repository";

export async function openRepository(): Promise<Repository> {
  return new MemoryRepository();
}
