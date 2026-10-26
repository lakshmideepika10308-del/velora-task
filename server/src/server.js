import mongoose from 'mongoose';import {app} from './app.js';
if(!process.env.JWT_SECRET||!process.env.MONGODB_URI){console.error('Set JWT_SECRET and MONGODB_URI (see .env.example)');process.exit(1);}
await mongoose.connect(process.env.MONGODB_URI);
const port=process.env.PORT||4000;app.listen(port,()=>console.log(`VELORA API on :${port}`));
