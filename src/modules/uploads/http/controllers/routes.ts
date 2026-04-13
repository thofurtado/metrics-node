import { FastifyInstance } from 'fastify';
import { verifyJwt } from '@/http/middlewares/verify-jwt';
import { uploadTransactionReceipt, uploadProductImage, uploadEmployeePhoto } from './upload';

export async function uploadsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt);

    app.post('/uploads/transaction/:id', uploadTransactionReceipt);
    app.post('/uploads/product/:id', uploadProductImage);
    app.post('/uploads/employee/:id', uploadEmployeePhoto);
}
