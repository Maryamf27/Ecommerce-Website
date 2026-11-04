import mongoose from "mongoose";
import { tagRepository } from "@/repositories/tag-repository";
import type { TagDTO } from "@/types/product";

export class TagInUseError extends Error {
  constructor() {
    super("This tag is assigned to products. Remove it from those products before deleting it.");
    this.name = "TagInUseError";
  }
}

function toTagDTO(tag: { _id: mongoose.Types.ObjectId; name: string; slug: string }): TagDTO {
  return { _id: tag._id.toString(), name: tag.name, slug: tag.slug };
}

export async function listTags(): Promise<TagDTO[]> {
  return (await tagRepository.list()).map(toTagDTO);
}

export async function createTag(name: string, slug: string): Promise<TagDTO> {
  return toTagDTO(await tagRepository.create(name, slug));
}

export async function renameTag(id: string, name: string, slug: string): Promise<TagDTO | null> {
  const tag = await tagRepository.update(id, name, slug);
  return tag ? toTagDTO(tag) : null;
}

export async function deleteTag(id: string): Promise<boolean> {
  const result = await tagRepository.deleteIfUnused(id);
  if (result === "in-use") throw new TagInUseError();
  return result === "deleted";
}
