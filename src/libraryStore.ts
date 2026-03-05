import { Project, ProjectNode, ID } from "./schema";

export interface LibraryStore {
  // Projects
  listProjects(): Promise<Project[]>;
  getProject(id: ID): Promise<Project | null>;
  putProject(project: Project): Promise<void>;
  deleteProject(id: ID): Promise<void>;

  // Documents
  listDocuments(projectId: ID): Promise<Document[]>;
  getDocument(id: ID): Promise<Document | null>;
  putDocument(doc: Document): Promise<void>;
  deleteDocument(id: ID): Promise<void>;

  // Project structure (folders + document references)
  listNodes(projectId: ID): Promise<ProjectNode[]>;
  putNode(node: ProjectNode): Promise<void>;
  deleteNode(id: ID): Promise<void>;
}
