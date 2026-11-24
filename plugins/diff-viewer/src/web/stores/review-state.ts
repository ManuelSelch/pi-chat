import type { ReviewComment } from "../../domain/review.js";
export interface ReviewState {
  comments:ReviewComment[];
  editor:{id:string;body:string}|null;
  sending:boolean;
  error:string|null;
}
export const emptyReview:ReviewState = {comments:[],editor:null,sending:false,error:null};
