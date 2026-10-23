"""
SAGE Dual-Branch Deepfake Detection Architecture and Checkpoint Loader.
Reconstructed faithfully from the original training notebook (SAGE.ipynb).

Model: B4BayarGatedDetector
- Semantic Branch: DINOv2-small + Spatial & Temporal Attention (B2)
- Forensic Branch: 5x5 Learnable Bayar Constrained Convolution + DSWC + 3D Temporal Conv
- Gated Fusion: Disagreement alpha-fusion mechanism
- Classifier: MLP predicting binary logit (0: REAL, 1: FAKE)
"""

import os
from pathlib import Path
from typing import Dict, Any, Tuple

import torch
import torch.nn as nn
from transformers import AutoModel


class DSWCBlock(nn.Module):
    """Depthwise Separable Convolution block with residual connection."""

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1):
        super().__init__()
        # Depthwise
        self.dw = nn.Conv2d(
            in_channels,
            in_channels,
            kernel_size=3,
            stride=stride,
            padding=1,
            groups=in_channels,
            bias=False,
        )
        # Pointwise
        self.pw = nn.Conv2d(
            in_channels, out_channels, kernel_size=1, bias=False
        )
        self.bn = nn.BatchNorm2d(out_channels)
        self.gelu = nn.GELU()

        # Residual shortcut for channel/stride matching
        self.shortcut = nn.Sequential()
        if stride != 1 or in_channels != out_channels:
            self.shortcut = nn.Sequential(
                nn.Conv2d(
                    in_channels,
                    out_channels,
                    kernel_size=1,
                    stride=stride,
                    bias=False,
                ),
                nn.BatchNorm2d(out_channels),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.shortcut(x)
        x = self.dw(x)
        x = self.pw(x)
        x = self.bn(x)
        return self.gelu(x + res)


class BayarConv2d(nn.Module):
    """
    Learnable 5x5 Constrained Convolution filter.
    Enforces high-pass forensic constraint: center pixel is -1,
    and all surrounding 24 weights sum to 1.
    """

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.in_channels = in_channels
        self.out_channels = out_channels

        # Learnable 5x5 filters
        self.kernel = nn.Parameter(
            torch.randn(out_channels, in_channels, 5, 5, dtype=torch.float32)
        )
        nn.init.xavier_normal_(self.kernel)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 1. Clone weights to preserve autograd graph
        weight = self.kernel.clone()

        # 2. Zero out the center pixel (index 2, 2 in 5x5 filter)
        weight[:, :, 2, 2] = 0.0

        # 3. Normalize surrounding pixels to sum to 1
        sum_weight = weight.sum(dim=(2, 3), keepdim=True)
        weight = weight / (sum_weight + 1e-8)

        # 4. Force center pixel to -1 (High-Pass Constraint)
        weight[:, :, 2, 2] = -1.0

        # 5. Apply convolution with padding=2 to keep 224x224 spatial size
        return torch.nn.functional.conv2d(x, weight, padding=2)


class ForensicBranchBayar(nn.Module):
    """
    Forensic High-Frequency Branch (B3-c).
    Extracts forensic artifacts using learnable Bayar convolution,
    spatial DSWC blocks, and 3D temporal convolution.
    """

    def __init__(self):
        super().__init__()
        # 1 input channel (grayscale), 3 output channels (feeding into DSWC)
        self.bayar = BayarConv2d(1, 3)

        # Spatial DSWC blocks: 224 -> 112 -> 56 -> 28
        self.dswc1 = DSWCBlock(3, 32, stride=2)
        self.dswc2 = DSWCBlock(32, 64, stride=2)
        self.dswc3 = DSWCBlock(64, 128, stride=2)

        # Temporal Modeling across the T frames
        self.temporal_dw = nn.Conv3d(
            128,
            128,
            kernel_size=(3, 1, 1),
            padding=(1, 0, 0),
            groups=128,
            bias=False,
        )
        self.temporal_bn = nn.BatchNorm3d(128)
        self.gelu = nn.GELU()

    def forward(self, videos: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = videos.shape

        # 1. Grayscale Conversion (standard ITU-R BT.601 weights)
        gray = (
            0.2989 * videos[:, :, 0:1, :, :]
            + 0.5870 * videos[:, :, 1:2, :, :]
            + 0.1140 * videos[:, :, 2:3, :, :]
        )
        gray = gray.reshape(B * T, 1, H, W)

        # 2. Extract High-Frequency Magnitude via learnable BayarConv
        high_freq = self.bayar(gray)

        # 3. Spatial Feature Extraction
        x = self.dswc1(high_freq)
        x = self.dswc2(x)
        x = self.dswc3(x)

        # 4. Restore Temporal Dimension: [B*T, 128, 28, 28] -> [B, 128, T, 28, 28]
        x = x.view(B, T, 128, 28, 28).permute(0, 2, 1, 3, 4)

        # 5. Temporal Processing
        t_res = x
        x = self.temporal_dw(x)
        x = self.temporal_bn(x)
        x = self.gelu(x + t_res)

        # 6. Global Average Pooling over (T, H, W) -> [B, 128]
        video_features = x.mean(dim=(2, 3, 4))
        return video_features


class B2SpatialTemporalExtractor(nn.Module):
    """
    Semantic Branch (B2 Spatial-Temporal Extractor).
    Uses frozen DINOv2-small backbone to extract 256 patch tokens per frame,
    tracks spatial features across time with 3D convs, and applies
    learned temporal and spatial attention.
    """

    def __init__(self, dino_model: nn.Module):
        super().__init__()
        self.dino = dino_model

        # Spatial projection: 384 -> 192
        self.spatial_projection = nn.Sequential(
            nn.Conv2d(384, 192, kernel_size=1, bias=False),
            nn.BatchNorm2d(192),
            nn.GELU(),
        )

        # Local spatial refinement
        self.spatial_depthwise = nn.Conv2d(
            192, 192, kernel_size=3, padding=1, groups=192, bias=False
        )
        self.spatial_norm = nn.BatchNorm2d(192)
        self.spatial_refinement = nn.Sequential(
            nn.Conv2d(192, 192, kernel_size=1, bias=False),
            nn.BatchNorm2d(192),
            nn.GELU(),
        )

        # Temporal depthwise processing: 3D conv along time dimension
        self.temporal_depthwise = nn.Conv3d(
            192,
            192,
            kernel_size=(3, 1, 1),
            padding=(1, 0, 0),
            groups=192,
            bias=False,
        )
        self.temporal_norm = nn.BatchNorm3d(192)

        # Channel compression: 192 -> 128
        self.temporal_projection = nn.Sequential(
            nn.Conv3d(192, 128, kernel_size=1, bias=False),
            nn.BatchNorm3d(128),
            nn.GELU(),
        )

        # Learned temporal gating attention
        self.temporal_gate = nn.Sequential(
            nn.Conv3d(128, 32, kernel_size=1),
            nn.GELU(),
            nn.Conv3d(32, 1, kernel_size=1),
        )

        # Learned spatial attention
        self.spatial_attention = nn.Sequential(
            nn.Conv2d(128, 32, kernel_size=1),
            nn.GELU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

    def extract_dino_tokens(self, videos: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = videos.shape
        frames = videos.reshape(B * T, C, H, W)
        outputs = self.dino(pixel_values=frames)
        # Drop CLS token at index 0 -> keep [B*T, 256, 384]
        patch_tokens = outputs.last_hidden_state[:, 1:, :]
        return patch_tokens

    def forward(self, videos: torch.Tensor) -> torch.Tensor:
        B, T, C, H, W = videos.shape

        with torch.no_grad():
            patch_tokens = self.extract_dino_tokens(videos)

        # Restore 2D patch grid: [B*T, 256, 384] -> [B*T, 384, 16, 16]
        x = patch_tokens.transpose(1, 2).reshape(B * T, 384, 16, 16)

        # Spatial projection and refinement
        x = self.spatial_projection(x)
        residual = x
        x = self.spatial_depthwise(x)
        x = self.spatial_norm(x)
        x = x + residual
        x = self.spatial_refinement(x)

        # Convert to Conv3D format: [B, 192, T, 16, 16]
        x = x.reshape(B, T, 192, 16, 16).permute(0, 2, 1, 3, 4)

        # Temporal depthwise processing
        temporal_residual = x
        x = self.temporal_depthwise(x)
        x = self.temporal_norm(x)
        x = x + temporal_residual
        x = torch.nn.functional.gelu(x)

        # Temporal channel projection: 192 -> 128
        x = self.temporal_projection(x)

        # Temporal attention aggregation
        temporal_logits = self.temporal_gate(x)
        temporal_weights = torch.softmax(temporal_logits, dim=2)
        x = (x * temporal_weights).sum(dim=2)  # [B, 128, 16, 16]

        # Spatial attention aggregation
        spatial_logits = self.spatial_attention(x)
        spatial_weights = torch.softmax(spatial_logits.flatten(2), dim=-1).reshape(
            B, 1, 16, 16
        )
        video_features = (x * spatial_weights).sum(dim=(2, 3))  # [B, 128]

        return video_features


class B4BayarGatedDetector(nn.Module):
    """
    Complete SAGE Model (B4):
    Dual-branch detector combining DINOv2 semantic features with Bayar high-pass
    forensic features via an interaction physics gated fusion mechanism.
    """

    def __init__(self, dino_model: nn.Module):
        super().__init__()

        # Branch 1: Semantic Extractor
        self.b2_extractor = B2SpatialTemporalExtractor(dino_model)

        # Branch 2: Forensic Signal Extractor
        self.forensic_extractor = ForensicBranchBayar()

        # Interaction Physics Gate: receives [f_b2, f_forensic, prod, diff] = 512-dim
        self.gate = nn.Sequential(
            nn.Linear(512, 128),
            nn.GELU(),
            nn.Linear(128, 1),
            nn.Sigmoid(),
        )

        # Final Binary Classifier
        self.classifier = nn.Sequential(
            nn.Linear(128, 64),
            nn.GELU(),
            nn.Dropout(p=0.2),
            nn.Linear(64, 1),
        )

        # ImageNet Normalization Constants for DINOv2
        self.register_buffer(
            "mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 1, 3, 1, 1)
        )
        self.register_buffer(
            "std", torch.tensor([0.229, 0.224, 0.225]).view(1, 1, 3, 1, 1)
        )

    def forward(
        self, videos: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        # 1. Feature Extraction
        videos_b2 = (videos - self.mean) / self.std
        f_b2 = self.b2_extractor(videos_b2)
        f_forensic = self.forensic_extractor(videos)

        # 2. Interaction Physics
        f_prod = f_b2 * f_forensic
        f_diff = torch.abs(f_b2 - f_forensic)

        # 3. Gating and Blending
        f_interaction = torch.cat([f_b2, f_forensic, f_prod, f_diff], dim=1)
        alpha = self.gate(f_interaction)

        f_fused = (alpha * f_b2) + ((1.0 - alpha) * f_forensic)

        # 4. Final Classification Logit
        logits = self.classifier(f_fused).squeeze(1)

        return logits, alpha, f_b2, f_forensic


class SAGEModelLoader:
    """
    Robust model loader for the released SAGE checkpoint (bayar.pth).
    Ensures safe weights loading, device handling, and version-agnostic
    DINOv2 key compatibility.
    """

    def __init__(self, checkpoint_path: str):
        self.checkpoint_path = Path(checkpoint_path)

        if not self.checkpoint_path.exists():
            raise FileNotFoundError(
                f"Checkpoint file not found: {self.checkpoint_path}"
            )

        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        # 1. Load base DINOv2 backbone
        self.dino_model_name = "facebook/dinov2-small"
        dino = AutoModel.from_pretrained(self.dino_model_name)
        dino.eval()
        for param in dino.parameters():
            param.requires_grad = False

        # 2. Build SAGE architecture
        self.model = B4BayarGatedDetector(dino)

        # 3. Safely load checkpoint weights (weights_only=True)
        raw_state_dict = torch.load(
            str(self.checkpoint_path),
            map_location=self.device,
            weights_only=True,
        )

        # 4. Handle transformers attention layer naming compatibility
        # (transformers <4.45 used .attention.attention.query / .output.dense,
        # newer transformers versions use .q_proj / .o_proj)
        remapped_state_dict = self._align_state_dict_keys(
            raw_state_dict, self.model.state_dict()
        )

        # 5. Load weights strictly
        self.model.load_state_dict(remapped_state_dict, strict=True)
        self.model.to(self.device)
        self.model.eval()

    def _align_state_dict_keys(
        self,
        checkpoint_dict: Dict[str, torch.Tensor],
        target_dict: Dict[str, torch.Tensor],
    ) -> Dict[str, torch.Tensor]:
        """Align legacy and current DINOv2 attention projection key names."""
        aligned_dict = {}

        # Check if target model uses new q_proj naming
        target_uses_q_proj = any(".q_proj." in k for k in target_dict.keys())

        for k, v in checkpoint_dict.items():
            new_k = k
            if target_uses_q_proj and "b2_extractor.dino.encoder.layer." in k:
                new_k = new_k.replace(
                    ".attention.attention.query.", ".attention.q_proj."
                )
                new_k = new_k.replace(
                    ".attention.attention.key.", ".attention.k_proj."
                )
                new_k = new_k.replace(
                    ".attention.attention.value.", ".attention.v_proj."
                )
                new_k = new_k.replace(
                    ".attention.output.dense.", ".attention.o_proj."
                )
            aligned_dict[new_k] = v

        return aligned_dict

    @torch.inference_mode()
    def predict(self, video_tensor: torch.Tensor) -> Dict[str, Any]:
        """
        Run inference on preprocessed video tensor.
        Input shape: [1, T, 3, 224, 224] (T typically 30).
        Returns prediction, probabilities, and interaction telemetry.
        """
        self.model.eval()
        video_tensor = video_tensor.to(self.device)

        logits, alpha, f_b2, f_forensic = self.model(video_tensor)

        # Output shape is scalar logit for batch size 1
        logit_val = logits.reshape(-1)[0].item()

        # Sigmoid computes probability of class 1 (FAKE)
        fake_probability = torch.sigmoid(torch.tensor(logit_val)).item()
        authentic_probability = 1.0 - fake_probability

        # Decision threshold = 0.5 (as defined in SAGE.ipynb evaluate function)
        prediction = "FAKE" if fake_probability >= 0.5 else "REAL"

        # Forensic interaction metric
        gate_alpha = alpha.reshape(-1)[0].item()

        return {
            "prediction": prediction,
            "fake_probability": float(fake_probability),
            "authentic_probability": float(authentic_probability),
            "logit": float(logit_val),
            "disagreement_alpha": float(gate_alpha),
            "device": str(self.device),
        }
