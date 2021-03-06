import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request, { Test } from "supertest";
import { app } from "../app";
import jwt from "jsonwebtoken";

jest.mock("../nats-wrapper");

declare global {
  namespace NodeJS {
    interface Global {
      signin(): string[];
      createProject(cookie?: string[]): Test;
      parseCookie(cookie: string[]): { id: string; email: string };
    }
  }
}

let mongo: any;
beforeAll(async () => {
  process.env.JWT_KEY = "asdfasdf";
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  mongo = new MongoMemoryServer();
  const mongoUri = await mongo.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

beforeEach(async () => {
  jest.clearAllMocks();
  const collections = mongoose.connection.collections;

  for (let collection in collections) {
    await collections[collection].deleteMany({});
  }
});

afterAll(async () => {
  await mongo.stop();
  await mongoose.connection.close();
});

global.signin = () => {
  // Build a JWT payload.  { id, email }
  const payload = {
    id: new mongoose.Types.ObjectId().toHexString(),
    email: "test@test.com",
  };

  // Create the JWT!
  const token = jwt.sign(payload, process.env.JWT_KEY!);

  // Build session Object. { jwt: MY_JWT }
  const session = { jwt: token };

  // Turn that session into JSON
  const sessionJSON = JSON.stringify(session);

  // Take JSON and encode it as base64
  const base64 = Buffer.from(sessionJSON).toString("base64");

  // return a string thats the cookie with the encoded data
  return [`express:sess=${base64}`];
};

global.parseCookie = (cookie: string[]): { id: string; email: string } => {
  return jwt.verify(
    JSON.parse(Buffer.from(cookie[0].split("=")[1], "base64").toString()).jwt,
    process.env.JWT_KEY!
  ) as any;
};

global.createProject = (cookie: string[] = global.signin()) =>
  request(app)
    .post("/api/projects")
    .set("Cookie", cookie)
    .send({
      title: "title",
      description: "description",
    })
    .expect(201);
