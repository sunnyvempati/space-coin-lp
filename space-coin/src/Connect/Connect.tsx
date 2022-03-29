import LoadingButton from "@mui/lab/LoadingButton";
import { Alert, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";
import { useConnect } from "wagmi";
import styles from "./Connect.module.css";

export const Connect = () => {
  const [{ data, loading, error: connectError }, connect] = useConnect();
  const [error, setError] = useState<string | null>(null);
  const metamaskConnector = data.connectors[0];

  useEffect(() => {
    if (connectError?.message) {
      setError(connectError.message);
    }
  }, [connectError]);

  return (
    <div className={styles.container}>
      <LoadingButton
        loading={loading}
        disabled={!metamaskConnector.ready}
        key={metamaskConnector.id}
        onClick={() => connect(metamaskConnector)}
        variant="contained"
        size="large"
      >
        Connect to metamask
      </LoadingButton>

      <Snackbar
        open={!!error}
        onClose={() => setError(null)}
        autoHideDuration={6000}
        message="Failed to connect"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error">This is a success message!</Alert>
      </Snackbar>
    </div>
  );
};
