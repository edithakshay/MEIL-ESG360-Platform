import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import esgRouter from "./esg";
import productRouter from "./product";
import enterpriseRouter from "./enterprise";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(esgRouter);
router.use(productRouter);
router.use(enterpriseRouter);

export default router;
