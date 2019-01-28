// GQL server

const { ApolloServer, gql } = require('apollo-server');
const photos = require('../data/photos.json');
const { generate } = require('shortid');
const users = require('../data/users.json');

// schema / types --------------------------------------------------------
const typeDefs = gql`
  type Query {
    Photo(id: ID!): Photo
    totalPhotos: Int!
    totalUsers: Int!
    allUsers: [User!]!
    User(id: ID!): User!
    allPhotos: [Photo!]!
  }
  type Photo {
    id: ID!
    name: String!
    description: String
    category: PhotoCategory!
    url: String!
    postedBy: User!
  }
  type User {
    id: ID!
    name: String!
    postedPhotos: [Photo!]!
  }
  enum PhotoCategory {
    PORTRAIT
    LANSCAPE
    ACTION
    SELFIE
  }
  input PostPhotoInput {
    name: String!
    description: String
    category: PhotoCategory = PORTRAIT
  }
  type Mutation {
    postPhoto(input: PostPhotoInput!): Photo!
  }
`;

// resolvers -------------------------------------------------------
const resolvers = {
  Query: {
    totalPhotos: () => photos.length,
    allPhotos: () => photos,
    Photo: (parent, { id }) => photos.find(photo => photo.id === id),
    totalUsers: () => users.length,
    allUsers: () => users,
    User: (parent, { id }) => users.find(user => user.id === id),
  },
  Mutation: {
    postPhoto: (parent, { input }) => {
      let newPhoto = {
        id: generate(),
        ...input,
      };
      photos.push(newPhoto);
      return newPhoto;
    },
  },
  Photo: {
    url: parent => `/img/photos/${parent.id}.jpg`,
    postedBy: parent => users.find(user => user.id === parent.userID),
  },
  User: {
    postedPhotos: parent => photos.filter(photo => photo.userID === parent.id),
  },
};

// server -------------------------------------------------------
const server = new ApolloServer({ typeDefs, resolvers });
server.listen().then(({ port }) => console.log(`server running on ${port}`));
