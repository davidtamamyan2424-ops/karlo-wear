import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { getProductById, listProducts } from "../services/products.js";

export const productsRouter = Router();

productsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listProducts());
  }),
);

productsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getProductById(req.params.id));
  }),
);
