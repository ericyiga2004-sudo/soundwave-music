import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const createStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      resource_type: "auto",
    },
  });

export const songUpload = multer({
  storage: createStorage("music_app/songs"),
});

export const artistUpload = multer({
  storage: createStorage("music_app/artists"),
});

export const albumUpload = multer({
  storage: createStorage("music_app/albums"),
});