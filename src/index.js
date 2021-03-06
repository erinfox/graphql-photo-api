const { ApolloServer, gql } = require('apollo-server');
const { MongoClient, ObjectID } = require('mongodb');
const { authorizeWithGithub } = require('./lib');

const typeDefs = gql`
  type Photo {
    id: ID!
    name: String!
    description: String
    category: PhotoCategory!
    url: String
    postedBy: User!
  }

  type User {
    githubLogin: ID!
    name: String!
    avatar: String!
    postedPhotos: [Photo!]!
  }

  enum PhotoCategory {
    PORTRAIT
    LANDSCAPE
    ACTION
    SELFIE
  }

  input PostPhotoInput {
    name: String!
    description: String
    category: PhotoCategory = PORTRAIT
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    totalPhotos: Int!
    allPhotos: [Photo!]!
    Photo(id: ID!): Photo!
    totalUsers: Int!
    allUsers: [User!]!
    User(githubLogin: ID!): User
  }

  type Mutation {
    postPhoto(input: PostPhotoInput!): Photo!
    githubAuth(code: String!): AuthPayload!
  }
`;

const resolvers = {
  Query: {
    totalPhotos: (parent, args, { photos }) => photos.countDocuments(),
    allPhotos: (parent, args, { photos }) => photos.find().toArray(),
    Photo: (parent, { id }, { photos }) =>
      photos.findOne({ _id: ObjectID(id) }),
    totalUsers: (parent, args, { users }) => users.countDocuments(),
    allUsers: (parent, args, { users }) => users.find().toArray(),
    User: (parent, { githubLogin }, { users }) =>
      users.findOne({ githubLogin }),
  },
  Mutation: {
    postPhoto: async (parent, { input }, { photos, currentUser }) => {
      if (!currentUser) {
        throw new Error('only an authorized user can post a photo');
      }

      const newPhoto = {
        ...input,
        userID: currentUser.githubLogin,
      };

      const { insertedId } = await photos.insertOne(newPhoto);
      newPhoto.id = insertedId.toString();

      return newPhoto;
    },
    githubAuth: async (parent, { code }, { users }) => {
      const payload = await authorizeWithGithub({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      });

      if (payload.message) {
        throw new Error(payload.message);
      }

      const githubUserInfo = {
        githubLogin: payload.login,
        name: payload.name,
        avatar: payload.avatar_url,
        githubToken: payload.access_token,
      };

      const {
        ops: [user],
      } = await users.replaceOne(
        { githubLogin: payload.login },
        githubUserInfo,
        { upsert: true },
      );

      return { user, token: user.githubToken };
    },
  },
  Photo: {
    id: parent => parent.id || parent._id.toString(),
    url: parent => `/img/photos/${parent.id || parent._id.toString()}.jpg`,
    postedBy: (parent, args, { users }) =>
      users.findOne({ githubLogin: parent.userID }),
  },
  User: {
    postedPhotos: (parent, args, { photos }) =>
      photos.find({ userID: parent.githubLogin }).toArray(),
  },
};

const start = async () => {
  const client = await MongoClient.connect(
    process.env.DB_HOST,
    { useNewUrlParser: true },
  );
  const db = client.db();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: {
      photos: db.collection('photos'),
      users: db.collection('users'),
      currentUser: null,
    },
  });

  server
    .listen()
    .then(console.log('Client ID', process.env.GITHUB_CLIENT_ID))
    .then(console.log('Client Secret', process.env.GITHUB_CLIENT_SECRET))
    .then(({ port }) => `server listening on ${port}`)
    .then(console.log)
    .catch(console.error);
};

start();
