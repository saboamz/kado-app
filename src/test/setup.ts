import { config } from 'dotenv';

// Integration tests talk to the database named in .env.
config({ path: '.env' });
