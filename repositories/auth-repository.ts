import User from "@/models/User";

/** Database-only user operations used by authentication services. */
export const authRepository = {
  findByEmailWithPassword(email: string) {
    return User.findOne({ email }).select("+passwordHash");
  },
  async createCustomer(input: { name: string; email: string; passwordHash: string }) {
    await User.init();
    return User.create({ ...input, role: "customer" });
  },
};
