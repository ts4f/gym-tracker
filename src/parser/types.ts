import { Exercise } from "../model/types";

export interface ParseError {
  line: number;
  message: string;
}

export interface ParsedBlock {
  exercises: Exercise[];
  comments: string[];
}

export interface ParseResult {
  workout: ParsedBlock;
  errors: ParseError[];
}
