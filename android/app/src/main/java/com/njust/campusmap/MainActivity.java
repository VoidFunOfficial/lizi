package com.njust.campusmap;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JwImportPlugin.class);
        registerPlugin(HeadingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
