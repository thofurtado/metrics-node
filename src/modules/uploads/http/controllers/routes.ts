import { FastifyInstance } from 'fastify';
import { verifyJwt } from '@/http/middlewares/verify-jwt';
import { 
    uploadTransactionReceipt, 
    uploadProductImage,
    deleteProductImage, 
    uploadEmployeePhoto, 
    deleteTransactionReceipt,
    uploadStandaloneReceipt,
    listStandaloneReceipts,
    deleteStandaloneReceipt,
    linkReceiptToTransaction
} from './upload';

export async function uploadsRoutes(app: FastifyInstance) {
    app.addHook('onRequest', verifyJwt);

    app.post('/uploads/transaction/:id', uploadTransactionReceipt);
    app.post('/uploads/product/:id', uploadProductImage);
    app.put('/uploads/product/:id', uploadProductImage);
    app.delete('/uploads/product/:id', deleteProductImage);
    app.post('/uploads/employee/:id', uploadEmployeePhoto);
    
    app.delete('/uploads/transaction/:id', deleteTransactionReceipt);

    // Standalone Receipts (Pendentes)
    app.post('/uploads/receipts', uploadStandaloneReceipt);
    app.post('/uploads/standalone', uploadStandaloneReceipt); // Bypass directory clash
    app.get('/uploads/receipts', listStandaloneReceipts);
    app.delete('/uploads/receipts/:filename', deleteStandaloneReceipt);
    app.patch('/uploads/receipts/:filename/link/:transactionId', linkReceiptToTransaction);
}
