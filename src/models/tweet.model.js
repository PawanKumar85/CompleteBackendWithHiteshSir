import mongoose from "mongoose";

const twwetSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Tweet = mongoose.model("Tweet", twwetSchema);
export default Tweet;
