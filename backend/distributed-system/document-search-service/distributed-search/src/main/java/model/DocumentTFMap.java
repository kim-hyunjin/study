package model;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

public class DocumentTFMap implements Serializable {
    private Map<String, TFMap> documentToTFMap = new HashMap<>();

    public void putDocumentTFMap(String documentName, TFMap tfMap) {
        documentToTFMap.put(documentName, tfMap);
    }

    public Map<String, TFMap> getDocumentToTFMap() {
        return documentToTFMap;
    }
}
