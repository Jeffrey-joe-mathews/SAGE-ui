
import torch


class SAGEModelLoader:
    def __init__(self, checkpoint_path: str):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        self.checkpoint_path = checkpoint_path

        # TODO: Import and initialize the exact SAGE model
        # classes from SAGE.ipynb.
        #
        # Then load the released checkpoint using the
        # correct checkpoint format and call model.eval().

        raise NotImplementedError(
            "Integrate the actual SAGE architecture and "
            "checkpoint loading code from SAGE.ipynb first."
        )
