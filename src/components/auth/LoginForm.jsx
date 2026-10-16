import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  LockOutlined,
  PersonOutline,
} from "@mui/icons-material";

export default function LoginForm({ onSubmit, busy, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <Box
      sx={{
        minHeight: "100dvh",
        width: "100%",
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
        px: 2,
        py: 5,
        // Imagen de fondo Thian Candle
        backgroundImage: `
      linear-gradient(
        rgba(255, 249, 242, 0.15),
        rgba(255, 249, 242, 0.30)
      ),
      url("${import.meta.env.BASE_URL}login-background.jpg")
    `,
        backgroundSize: "cover",
        backgroundPosition: {
          xs: "65% center",
          sm: "center center",
        },
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 455,
          px: { xs: 3, sm: 5 },
          py: { xs: 4, sm: 5 },
          borderRadius: "22px",
          border: "1px solid #f4e8de",
          boxShadow: "0 22px 60px rgba(89,53,31,.12)",
        }}
      >
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
          <Box
            component="img"
            src={`${import.meta.env.BASE_URL}logo-thian.png`}
            alt="Thian Candle"
            sx={{
              width: { xs: 130, sm: 140 },
              height: "auto",
              objectFit: "contain",
              mb: 2,
            }}
          />

          <Typography
            variant="h6"
            component="h1"
            sx={{
              color: "text.secondary",
              textAlign: "center",
            }}
          >
            Gestión de pedidos y producción
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "#8c7566", mb: 3 }}>
          Ingresa con tu usuario para continuar
        </Typography>
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2.5}>
            <TextField
              name="username"
              label="Nombre de usuario"
              autoComplete="username"
              required
              fullWidth
              slotProps={{
                htmlInput: {
                  minLength: 4,
                  maxLength: 20,
                  pattern: "[a-zA-Z0-9._]{4,20}",
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline sx={{ color: "#a68b78" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              name="password"
              label="Contraseña"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: "#a68b78" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          visible ? "Ocultar contraseña" : "Mostrar contraseña"
                        }
                        onClick={() => setVisible((v) => !v)}
                        edge="end"
                      >
                        {visible ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {error && (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            )}
            <Button
              type="submit"
              disabled={busy}
              variant="contained"
              size="large"
              sx={{
                mt: 1,
                minHeight: 52,
                borderRadius: "16px",
                color: "#fff",
                background:
                  "linear-gradient(105deg, #ffb52e, #ff852b 55%, #f45132)",
                boxShadow: "0 8px 20px rgba(244, 117, 45, .24)",
                "&:hover": {
                  background:
                    "linear-gradient(105deg, #f5a51c, #f47521 55%, #dc3d22)",
                },
              }}
            >
              {busy ? (
                <>
                  <CircularProgress size={19} color="inherit" sx={{ mr: 1 }} />{" "}
                  Ingresando...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </Stack>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            color: "#a28b7c",
            mt: 4,
          }}
        >
          🔒 Acceso privado para personal autorizado
        </Typography>
        {/* Créditos del desarrollador */}
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            color: "text.secondary",
            fontSize: "0.65rem",
            fontWeight: 500,
            letterSpacing: "0.5px",
            mt: 1,
            opacity: 0.7,
          }}
        >
          {new Date().getFullYear()} ©  By{" "}
          <Box
            component="span"
            sx={{
              fontWeight: 700,
            }}
          >
            JRFactory
          </Box>
        </Typography>
      </Paper>
    </Box>
  );
}
