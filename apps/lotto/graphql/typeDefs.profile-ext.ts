import gql from "graphql-tag";

export const typeDefs = gql`
  # ...existing types...
  type UserProfile {
    id: ID!
    name: String
    phone: String!
    email: String
    createdAt: String
    status: String
    credit: Float
    lastLogin: String
    role: String
  }
  extend type Query {
    currentUser: UserProfile
  }
`;
